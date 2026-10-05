import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, localDiskWritable } from "@/lib/storage";
import { AdminPageHeader } from "@/components/admin/shell";
import {
  MediaGrid,
  type MediaFolderOption,
  type MediaSort,
} from "@/components/admin/media/media-grid";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "مكتبة الوسائط",
  description: "جميع صور وملفات الموقع، مع نسخ المسار لربطه بحقول الصور.",
};

const PER_PAGE = 36;

/** Folders the dashboard suggests first; any other folder found in the data
 *  is appended with its raw value as label. */
const FOLDER_ORDER = [
  "general",
  "hero",
  "services",
  "programs",
  "blog",
  "branding",
] as const;

const FOLDER_LABELS: Record<string, string> = {
  general: "عام",
  hero: "الواجهة الرئيسية",
  services: "الخدمات",
  programs: "البرامج",
  blog: "المدونة",
  branding: "الهوية البصرية",
};

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readSort(value: string | string[] | undefined): MediaSort {
  // Validated inline: a Server Component must not read plain values out of a
  // "use client" module — they arrive as client-reference proxies.
  const raw = one(value);
  return raw === "name" || raw === "size" ? raw : "date";
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthContext();
  const user = context.user;
  if (!user) redirect("/admin/login");

  // The local driver cannot work on a read-only filesystem, so tell the
  // operator before they pick a file rather than after the upload fails.
  const storageDriver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  const uploadsPossible = storageDriver === "supabase" || localDiskWritable();
  if (!can(user.role, "media.view")) redirect("/admin");

  const params = await searchParams;
  const sort = readSort(params.sort);
  const dir = one(params.dir).toLowerCase() === "asc" ? "asc" : "desc";
  const q = one(params.q).trim().slice(0, 120);
  const folder = one(params.folder).trim().replace(/[^a-z0-9/_-]/gi, "").slice(0, 60);
  const requestedPage = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const where: Prisma.MediaAssetWhereInput = {
    ...(folder ? { folder } : {}),
    ...(q ? { filename: { contains: q } } : {}),
  };

  const orderBy: Prisma.MediaAssetOrderByWithRelationInput =
    sort === "name"
      ? { filename: dir }
      : sort === "size"
        ? { size: dir }
        : { createdAt: dir };

  // Count first so an out-of-range `?page=` cannot ask for rows past the end.
  const [total, groups, totalSize] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.groupBy({ by: ["folder"], _count: { _all: true } }),
    prisma.mediaAsset.aggregate({ _sum: { size: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(requestedPage, pageCount);

  const rows = await prisma.mediaAsset.findMany({
    where,
    orderBy,
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
    include: { uploadedBy: { select: { name: true } } },
  });

  const counts = new Map(groups.map((group) => [group.folder, group._count._all]));
  const folderNames = [
    ...FOLDER_ORDER,
    ...groups
      .map((group) => group.folder)
      .filter((name) => !(FOLDER_ORDER as readonly string[]).includes(name))
      .sort((a, b) => a.localeCompare(b, "ar")),
  ];
  const folders: MediaFolderOption[] = folderNames.map((name) => ({
    value: name,
    label: FOLDER_LABELS[name] ?? name,
    count: counts.get(name) ?? 0,
  }));

  return (
    <>
      <AdminPageHeader
        title="مكتبة الوسائط"
        description="الصور والملفات المستخدمة في الموقع. اضغط «نسخ المسار» ثم الصقه في أي حقل صورة."
        breadcrumb={[{ href: "/admin", label: "لوحة التحكم" }]}
      />

      {!uploadsPossible ? (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <h2 className="mb-2 font-bold">رفع الصور معطّل على هذه المنصة</h2>
          <p className="text-sm leading-7">
            نظام الملفات للقراءة فقط هنا، فلا يمكن حفظ الصور المرفوعة، وستظهر رسالة
            تقنية عند المحاولة. لتفعيل الرفع أضف المتغيرات الثلاثة التالية ثم أعد
            النشر:
          </p>
          <ul className="mt-3 space-y-1 text-sm" dir="ltr">
            <li>
              <code>STORAGE_DRIVER=supabase</code>
            </li>
            <li>
              <code>SUPABASE_URL=https://ygljghnwcexqpeusdvwb.supabase.co</code>
            </li>
            <li>
              <code>SUPABASE_SERVICE_ROLE_KEY=…</code>
            </li>
          </ul>
          <p className="mt-3 text-sm">
            مفتاح الخدمة من: Supabase ← Project Settings ← API ← Service Role.
            والخطوات كاملة في <code>docs/DEPLOYMENT.md</code>.
          </p>
        </div>
      ) : null}

      <MediaGrid
        assets={rows.map((row) => ({
          id: row.id,
          filename: row.filename,
          path: row.path,
          mimeType: row.mimeType,
          size: row.size,
          width: row.width,
          height: row.height,
          alt: row.alt,
          folder: row.folder,
          uploader: row.uploadedBy?.name ?? null,
          createdAt: row.createdAt.toISOString(),
        }))}
        folders={folders}
        total={total}
        totalSize={totalSize._sum.size ?? 0}
        page={page}
        pageCount={pageCount}
        query={{ folder, q, sort, dir }}
        canUpload={can(user.role, "media.upload")}
        canDelete={can(user.role, "media.delete")}
        accept={Object.keys(ALLOWED_MIME).join(",")}
        maxBytes={MAX_UPLOAD_BYTES}
      />
    </>
  );
}