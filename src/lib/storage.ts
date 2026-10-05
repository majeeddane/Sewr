import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Media storage with two drivers:
 *
 *  - "local"    → ./public/uploads/yyyy/mm/<random>.<ext>   (dev, VPS)
 *  - "supabase" → Supabase Storage bucket                   (managed)
 *
 * Both return the same shape, so the rest of the app never branches on the
 * driver. See docs/DEPLOYMENT.md for switching.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
  ".pdf",
];

export interface StoredFile {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

function driver(): string {
  return (process.env.STORAGE_DRIVER || "local").toLowerCase();
}

export function isAllowedMime(mime: string): boolean {
  return Boolean(ALLOWED_MIME[mime]);
}

function extensionFor(filename: string, mime: string): string {
  const byMime = ALLOWED_MIME[mime];
  if (byMime) return `.${byMime}`;
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : ".bin";
}

/** Strips any path information a client might have sent. */
function safeName(filename: string): string {
  return path.basename(filename).replace(/[^\w.\-؀-ۿ]/g, "_").slice(0, 80);
}

export async function saveUpload(
  file: File,
  folder = "general",
): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت).`,
    );
  }
  if (!isAllowedMime(file.type)) {
    throw new Error("نوع الملف غير مدعوم. الصيغ المسموحة: JPG, PNG, WEBP, AVIF, GIF, SVG, PDF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const now = new Date();
  const ext = extensionFor(file.name, file.type);
  const name = `${randomBytes(12).toString("hex")}${ext}`;
  const relativeFolder = path
    .join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\\/g, "/");

  if (driver() === "supabase") return saveToSupabase(buffer, name, file.type, folder, relativeFolder);
  return saveToDisk(buffer, name, file.type, folder, relativeFolder);
}

/**
 * Whether the local disk driver can work at all.
 *
 * On Vercel the project directory is a read-only image, so writing to
 * public/uploads fails with a bare `ENOENT: ... mkdir '/var/task/public/uploads'`
 * that tells the operator nothing. Detecting it up front lets us explain the
 * actual fix instead of surfacing a Node error in the dashboard.
 *
 * Vercel exposes exactly one writable directory, /tmp, and it is wiped between
 * invocations — so it cannot be used for uploads the site must keep serving.
 */
export function localDiskWritable(): boolean {
  // Serverless platforms that ship a read-only project tree.
  if (process.env.VERCEL) return false;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  return true;
}

/** Arabic explanation for the operator, shown in the dashboard. */
export const READ_ONLY_FS_MESSAGE =
  "نظام الملفات للقراءة فقط على منصة النشر، ولا يمكن حفظ الصور عليه. " +
  "لتفعيل رفع الصور: اضبط STORAGE_DRIVER=supabase مع SUPABASE_URL و" +
  "SUPABASE_SERVICE_ROLE_KEY في متغيرات البيئة. " +
  "الخطوات كاملة في docs/DEPLOYMENT.md.";

async function saveToDisk(
  buffer: Buffer,
  name: string,
  mimeType: string,
  folder: string,
  relativeFolder: string,
): Promise<StoredFile> {
  if (!localDiskWritable()) throw new Error(READ_ONLY_FS_MESSAGE);

  const dir = path.join(process.cwd(), "public", "uploads", relativeFolder);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "ENOSPC") {
      throw new Error(READ_ONLY_FS_MESSAGE);
    }
    throw error;
  }

  return {
    path: `/uploads/${relativeFolder}/${name}`,
    filename: safeName(name),
    mimeType,
    size: buffer.byteLength,
  };
}

async function saveToSupabase(
  buffer: Buffer,
  name: string,
  mimeType: string,
  folder: string,
  relativeFolder: string,
): Promise<StoredFile> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  if (!url || !key) throw new Error("إعدادات Supabase Storage غير مكتملة.");

  const cleanFolder = folder.replace(/[^a-z0-9/_-]/gi, "") || "general";
  const objectPath = `${relativeFolder}/${cleanFolder}/${name}`;

  const res = await fetch(
    `${url}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        // Both headers are required. `Authorization` proves the caller is the
        // service role; `apikey` tells the Storage API which project the
        // request is for. Sending only the Authorization header fails with a
        // bare 400 that carries no explanation.
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    },
  );

  if (!res.ok) {
    throw new Error(`تعذّر الرفع إلى Supabase Storage (${res.status}).`);
  }

  return {
    path: `${url}/storage/v1/object/public/${bucket}/${objectPath}`,
    filename: safeName(name),
    mimeType,
    size: buffer.byteLength,
  };
}

/**
 * Extracts the object path from a stored file reference.
 *
 * Two shapes exist and both must be understood:
 *
 *   local     /uploads/2026/10/branding/logo.png
 *   supabase  https://<project>.supabase.co/storage/v1/object/public/media/2026/10/branding/logo.png
 *
 * The Supabase driver stores a full URL, not a site-relative path, so anything
 * that only looks for "/uploads/" silently fails to match and the file can
 * never be deleted.
 */
function objectKeyFrom(publicPath: string): { kind: "supabase" | "local"; key: string } | null {
  const marker = "/storage/v1/object/public/";
  const at = publicPath.indexOf(marker);
  if (at !== -1) {
    const rest = publicPath.slice(at + marker.length);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    return { kind: "supabase", key: rest.slice(slash + 1) };
  }
  if (publicPath.startsWith("/uploads/")) {
    return { kind: "local", key: publicPath.slice("/uploads/".length) };
  }
  return null;
}

/** Removes a stored file. Never throws — deletion failures are logged only. */
export async function deleteUpload(publicPath: string): Promise<boolean> {
  try {
    const target = objectKeyFrom(publicPath);
    if (!target) return false;

    if (target.kind === "supabase") {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
      if (!url || !key) return false;

      const res = await fetch(`${url}/storage/v1/object/${bucket}/${target.key}`, {
        method: "DELETE",
        // apikey is required here too; without it the API answers 400.
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      return res.ok;
    }

    if (target.key.includes("..")) return false;
    await unlink(path.join(process.cwd(), "public", "uploads", target.key));
    return true;
  } catch (error) {
    console.error("[storage] تعذّر حذف الملف:", error);
    return false;
  }
}

/** Reads a locally-stored file (used to serve protected downloads). */
export async function readLocalUpload(publicPath: string): Promise<Buffer | null> {
  if (!publicPath.startsWith("/uploads/") || publicPath.includes("..")) return null;
  try {
    return await readFile(
      path.join(process.cwd(), "public", publicPath.replace(/^\/+/, "")),
    );
  } catch {
    return null;
  }
}

/** Extracts intrinsic dimensions from image bytes (no extra dependency). */
export async function imageDimensions(
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> {
  try {
    // PNG: IHDR chunk at byte 16.
    if (
      buffer.length > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    // GIF: little-endian 16-bit at 6 and 8.
    if (buffer.slice(0, 3).toString("latin1") === "GIF") {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    // JPEG: walk the segment markers to the first SOFn.
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        const size = buffer.readUInt16BE(offset + 2);
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + size;
      }
    }
    // WEBP (VP8X / VP8 / VP8L).
    if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") {
      const chunk = buffer.slice(12, 16).toString("latin1");
      if (chunk === "VP8X") {
        return {
          width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
          height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { width: null, height: null };
}
