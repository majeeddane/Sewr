"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Check,
  CloudUpload,
  FileText,
  FolderOpen,
  Images,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Pagination } from "@/components/admin/widgets";
import { Badge } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { toast } from "@/components/ui/toast";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { updateAlt } from "@/app/admin/(dashboard)/media/actions";

/**
 * Media library.
 *
 * A thumbnail grid plus everything the rest of the dashboard needs from it:
 * upload, preview, alt text and — most importantly — a one-click "copy path"
 * for the image fields that store a URL.
 */

export const MEDIA_SORTS = ["date", "name", "size"] as const;
export type MediaSort = (typeof MEDIA_SORTS)[number];
export type MediaDir = "asc" | "desc";

export interface MediaAssetItem {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  folder: string;
  uploader: string | null;
  createdAt: string;
}

export interface MediaFolderOption {
  value: string;
  label: string;
  count: number;
}

export interface MediaQuery {
  folder: string;
  q: string;
  sort: MediaSort;
  dir: MediaDir;
}

const BASE_PATH = "/admin/media";

const SORT_OPTIONS: Array<{ key: string; label: string; sort: MediaSort; dir: MediaDir }> = [
  { key: "date-desc", label: "الأحدث أولًا", sort: "date", dir: "desc" },
  { key: "date-asc", label: "الأقدم أولًا", sort: "date", dir: "asc" },
  { key: "name-asc", label: "الاسم (أ–ي)", sort: "name", dir: "asc" },
  { key: "size-desc", label: "الأكبر حجمًا", sort: "size", dir: "desc" },
  { key: "size-asc", label: "الأصغر حجمًا", sort: "size", dir: "asc" },
];

function buildHref(
  query: MediaQuery,
  overrides: { folder?: string; q?: string; sort?: MediaSort; dir?: MediaDir; page?: number } = {},
): string {
  const folder = overrides.folder ?? query.folder;
  const q = overrides.q ?? query.q;
  const sort = overrides.sort ?? query.sort;
  const dir = overrides.dir ?? query.dir;
  const page = overrides.page ?? 1;

  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (q) params.set("q", q);
  if (sort !== "date") params.set("sort", sort);
  if ((sort === "date" && dir === "asc") || dir !== "desc") params.set("dir", dir);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${BASE_PATH}?${search}` : BASE_PATH;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${formatNumber(value)} بايت`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} ك.ب`;
  return `${(value / 1024 / 1024).toFixed(1)} م.ب`;
}

function isRenderable(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Thumbnail with a graceful fallback when the file is gone from disk. */
function AssetThumb({
  asset,
  sizes,
  fit = "cover",
  className,
}: {
  asset: MediaAssetItem;
  sizes: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const renderable = isRenderable(asset.mimeType) && !failed;

  if (!renderable) {
    return (
      <span
        className={cn(
          "absolute inset-0 grid place-items-center bg-sand-100 dark:bg-white/5",
          className,
        )}
      >
        <FileText className="size-8 text-ink-300" aria-hidden />
      </span>
    );
  }

  return (
    <Image
      src={asset.path}
      alt={asset.alt ?? ""}
      fill
      sizes={sizes}
      onError={() => setFailed(true)}
      className={cn(
        fit === "contain"
          ? "object-contain"
          : "object-cover transition-transform duration-500 group-hover:scale-[1.04]",
        className,
      )}
      unoptimized={asset.path.startsWith("http") || asset.mimeType === "image/svg+xml"}
    />
  );
}

// ── Upload panel ──────────────────────────────────────────────

function Uploader({
  folders,
  accept,
  maxBytes,
  defaultFolder,
}: {
  folders: MediaFolderOption[];
  accept: string;
  maxBytes: number;
  defaultFolder: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [folder, setFolder] = React.useState(defaultFolder || "general");
  const [alt, setAlt] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);

  const pending = done < total;

  const send = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    if (alt.trim()) body.append("alt", alt.trim());

    const response = await fetch("/api/admin/media", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
    } | null;

    if (!response.ok || !data?.ok) {
      return data?.message ?? `تعذّر رفع الملف «${file.name}».`;
    }
    return null;
  };

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const allowed = accept.split(",").map((mime) => mime.trim()).filter(Boolean);
    const rejected: string[] = [];
    const queued: File[] = [];

    for (const file of files) {
      if (allowed.length > 0 && !allowed.includes(file.type)) {
        rejected.push(`«${file.name}»: صيغة غير مدعومة (${file.type || "غير معروفة"}).`);
        continue;
      }
      if (file.size > maxBytes) {
        rejected.push(`«${file.name}»: الحجم ${formatBytes(file.size)} يتجاوز ${formatBytes(maxBytes)}.`);
        continue;
      }
      queued.push(file);
    }

    setErrors(rejected);
    if (!queued.length) return;

    setDone(0);
    setTotal(queued.length);
    const failures: string[] = [];
    for (const file of queued) {
      try {
        const failure = await send(file);
        if (failure) failures.push(failure);
      } catch {
        failures.push(`تعذّر الاتصال بالخادم أثناء رفع «${file.name}».`);
      }
      setDone((value) => value + 1);
    }

    const sent = queued.length - failures.length;
    if (sent > 0) {
      toast.success(
        sent === 1 ? "تم رفع الملف بنجاح." : `تم رفع ${formatNumber(sent)} ملفات بنجاح.`,
      );
      setAlt("");
      router.refresh();
    }
    if (failures.length > 0) {
      setErrors([...rejected, ...failures]);
      toast.error(failures[0], failures.length > 1 ? `و${formatNumber(failures.length - 1)} ملف آخر فشل.` : undefined);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(Array.from(event.dataTransfer.files ?? []));
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
              : "border-sand-300 bg-sand-50 dark:border-white/15 dark:bg-white/5",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="size-7 animate-spin text-brand-700" aria-hidden />
              <p className="text-sm font-bold text-brand-900 dark:text-white">
                جارٍ الرفع… {formatNumber(done)} من {formatNumber(total)}
              </p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-sand-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-700 transition-all"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <CloudUpload className="size-7 text-brand-600" aria-hidden />
              <p className="text-sm font-bold text-brand-900 dark:text-white">
                اسحب الملفات هنا أو اخترها من جهازك
              </p>
              <p className="text-xs text-ink-500">
                الصيغ المسموحة: JPG · PNG · WEBP · AVIF · GIF · SVG · PDF — بحد أقصى{" "}
                {formatBytes(maxBytes)} للملف.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
          >
            <Upload className="size-3.5" aria-hidden />
            اختيار ملفات
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="sr-only"
            onChange={(event) => void upload(Array.from(event.target.files ?? []))}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Field label="المجلد" htmlFor="media-upload-folder">
            <Select
              id="media-upload-folder"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              {folders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="النص البديل"
            htmlFor="media-upload-alt"
            hint="وصف قصير للصورة لقارئات الشاشة ومحركات البحث."
          >
            <Input
              id="media-upload-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="مثال: جلسة جماعية في المركز"
              maxLength={200}
            />
          </Field>
        </div>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="mt-4 flex flex-col gap-1 text-xs font-semibold text-danger-600">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Preview dialog ────────────────────────────────────────────

function PreviewDialog({
  asset,
  folderLabel,
  onClose,
  canDelete,
}: {
  asset: MediaAssetItem;
  folderLabel: string;
  onClose: () => void;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [alt, setAlt] = React.useState(asset.alt ?? "");
  const [removing, setRemoving] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`تم نسخ ${label}.`);
    } catch {
      toast.error("تعذّر النسخ إلى الحافظة.");
    }
  };

  const saveAlt = async () => {
    const result = await run(() => updateAlt(asset.id, alt));
    if (result.ok) setAlt(alt.trim());
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const response = await fetch(`/api/admin/media?id=${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.message ?? "تعذّر حذف الملف.");
        return;
      }
      toast.success("تم حذف الملف من المكتبة.");
      onClose();
      router.refresh();
    } catch {
      toast.error("تعذّر الاتصال بالخادم.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة ${asset.filename}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/60 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        type="button"
        aria-label="إغلاق المعاينة"
        onClick={onClose}
        className="fixed inset-0 -z-10 cursor-default"
      />
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-lift dark:border-white/10 dark:bg-[#1b1524]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-brand-900 dark:text-white" dir="ltr">
              {asset.filename}
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {folderLabel} · {formatBytes(asset.size)} · {formatDate(asset.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-sand-100 dark:hover:bg-white/10"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="relative overflow-hidden rounded-xl border border-sand-200 bg-sand-100 dark:border-white/10 dark:bg-white/5">
            <div className="relative aspect-[4/3] w-full">
              <AssetThumb
                asset={asset}
                sizes="(min-width: 1024px) 45vw, 90vw"
                fit="contain"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">
                المسار العام
              </span>
              <code
                dir="ltr"
                className="block truncate rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-700 dark:bg-white/5 dark:text-ink-200"
              >
                {asset.path}
              </code>
              <button
                type="button"
                onClick={() => void copy(asset.path, "المسار")}
                className="mt-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900"
              >
                <Check className="size-3.5" aria-hidden />
                نسخ المسار
              </button>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-400">
                الصق هذا المسار في أي حقل صورة في لوحة التحكم أو في محرّر النصوص.
              </p>
            </div>

            <Field label="النص البديل (alt)" htmlFor={`alt-${asset.id}`}>
              <Textarea
                id={`alt-${asset.id}`}
                rows={3}
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="وصف موجز لمحتوى الصورة"
                maxLength={200}
              />
            </Field>
            <button
              type="button"
              onClick={() => void saveAlt()}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 text-xs font-bold text-brand-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ…" : "حفظ النص البديل"}
            </button>

            <dl className="flex flex-col gap-2 border-t border-sand-200 pt-4 text-xs dark:border-white/10">
              {[
                ["الأبعاد", asset.width && asset.height ? `${asset.width} × ${asset.height} بكسل` : "غير معروفة"],
                ["النوع", asset.mimeType],
                ["الحجم", formatBytes(asset.size)],
                ["المجلد", folderLabel],
                ["رفعه", asset.uploader ?? "غير معروف"],
                ["التاريخ", formatDate(asset.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-ink-500">{label}</dt>
                  <dd className="truncate text-ink-700 dark:text-ink-200" dir="ltr">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {canDelete && (
              <div className="border-t border-sand-200 pt-4 dark:border-white/10">
                <ConfirmButton
                  onConfirm={remove}
                  message="سيُحذف الملف من القرص ولن استخدامه في أي مكان. هل أنت متأكد؟"
                  confirmLabel="تأكيد حذف الملف"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  حذف الملف
                </ConfirmButton>
                {removing && <p className="mt-2 text-xs text-ink-400">جارٍ الحذف…</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────

export function MediaGrid({
  assets,
  folders,
  total,
  totalSize,
  page,
  pageCount,
  query,
  canUpload,
  canDelete,
  accept,
  maxBytes,
}: {
  assets: MediaAssetItem[];
  folders: MediaFolderOption[];
  total: number;
  totalSize: number;
  page: number;
  pageCount: number;
  query: MediaQuery;
  canUpload: boolean;
  canDelete: boolean;
  accept: string;
  maxBytes: number;
}) {
  const [preview, setPreview] = React.useState<MediaAssetItem | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const labelFor = React.useCallback(
    (folder: string) => folders.find((option) => option.value === folder)?.label ?? folder,
    [folders],
  );

  return (
    <div className="flex flex-col gap-5">
      {canUpload && (
        <button
          type="button"
          onClick={() => setUploading((value) => !value)}
          aria-expanded={uploading}
          className={cn(
            "inline-flex h-11 w-fit items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors",
            uploading
              ? "bg-brand-900 text-white"
              : "bg-brand-800 text-white hover:bg-brand-900",
          )}
        >
          <Upload className="size-4" aria-hidden />
          {uploading ? "إخفاء منطقة الرفع" : "رفع ملفات جديدة"}
        </button>
      )}

      {canUpload && uploading && (
        <Uploader
          folders={folders}
          accept={accept}
          maxBytes={maxBytes}
          defaultFolder={query.folder}
        />
      )}

      {/* ── Toolbar ───────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <nav aria-label="تصفية حسب المجلد" className="flex flex-wrap gap-2">
          <Link
            href={buildHref(query, { folder: "", page: 1 })}
            aria-current={query.folder ? undefined : "page"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              query.folder
                ? "bg-sand-100 text-ink-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10"
                : "bg-brand-800 text-white shadow-soft",
            )}
          >
            <Images className="size-3.5" aria-hidden />
            الكل
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.625rem]",
                query.folder ? "bg-white text-ink-500 dark:bg-white/10 dark:text-ink-400" : "bg-white/20",
              )}
            >
              {formatNumber(folders.reduce((sum, option) => sum + option.count, 0))}
            </span>
          </Link>
          {folders.map((option) => {
            const active = query.folder === option.value;
            return (
              <Link
                key={option.value}
                href={buildHref(query, { folder: option.value, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                  active
                    ? "bg-brand-800 text-white shadow-soft"
                    : "bg-sand-100 text-ink-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10",
                )}
              >
                <FolderOpen className="size-3.5" aria-hidden />
                {option.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.625rem]",
                    active ? "bg-white/20" : "bg-white text-ink-500 dark:bg-white/10 dark:text-ink-400",
                  )}
                >
                  {formatNumber(option.count)}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <form action={BASE_PATH} method="get" className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
            {query.folder && <input type="hidden" name="folder" value={query.folder} />}
            {query.sort !== "date" && <input type="hidden" name="sort" value={query.sort} />}
            {query.dir !== "desc" && <input type="hidden" name="dir" value={query.dir} />}
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-400"
              />
              <input
                key={`${query.folder}:${query.q}`}
                type="search"
                name="q"
                defaultValue={query.q}
                placeholder="ابحث باسم الملف…"
                aria-label="بحث في مكتبة الوسائط"
                className="h-10 w-full rounded-xl border border-sand-300 bg-white ps-9 pe-3 text-[0.8125rem] text-ink-800 shadow-sm transition-colors placeholder:text-ink-400 hover:border-sand-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/5 dark:text-ink-100"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900"
            >
              بحث
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5">
            <ArrowDownUp className="size-3.5 text-ink-400" aria-hidden />
            {SORT_OPTIONS.map((option) => {
              const active = query.sort === option.sort && query.dir === option.dir;
              return (
                <Link
                  key={option.key}
                  href={buildHref(query, { sort: option.sort, dir: option.dir, page: 1 })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[0.6875rem] font-bold transition-colors",
                    active
                      ? "bg-gold-500 text-brand-950"
                      : "bg-sand-100 text-ink-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10",
                  )}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-ink-500">
          {formatNumber(total)} ملف · الحجم الكلي {formatBytes(totalSize)}
          {query.q && (
            <>
              {" "}· نتائج البحث عن «{query.q}»
            </>
          )}
        </p>
      </div>

      {/* ── Tiles ──────────────────────────────────── */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <Images className="size-8 text-ink-300" aria-hidden />
          <p className="font-bold text-ink-600 dark:text-ink-300">
            {query.q ? "لا توجد ملفات مطابقة للبحث." : "المكتبة فارغة — ارفع أول ملف."}
          </p>
          {(query.q || query.folder) && (
            <Link
              href={buildHref(query, { folder: "", q: "", page: 1 })}
              className="text-xs font-bold text-brand-700 hover:underline"
            >
              عرض كل الملفات
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setPreview(asset)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white text-start shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card dark:border-white/10 dark:bg-white/5"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden bg-sand-100 dark:bg-white/5">
                  <AssetThumb asset={asset} sizes="(min-width: 1280px) 15vw, (min-width: 768px) 25vw, 45vw" />
                  {!asset.alt && (
                    <span className="absolute start-1.5 top-1.5">
                      <Badge tone="warn" className="px-2 py-0.5 text-[0.625rem]">
                        بلا نص بديل
                      </Badge>
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span
                    className="truncate text-xs font-bold text-brand-900 dark:text-white"
                    title={asset.filename}
                    dir="ltr"
                  >
                    {asset.filename}
                  </span>
                  <span className="text-[0.6875rem] text-ink-500" dir="ltr">
                    {formatBytes(asset.size)}
                    {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 text-[0.625rem] text-ink-400">
                    <span className="truncate">{labelFor(asset.folder)}</span>
                    <span className="shrink-0">{formatDate(asset.createdAt, { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
                  </span>
                  {asset.uploader && (
                    <span className="truncate text-[0.625rem] text-ink-400">
                      بواسطة {asset.uploader}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        buildHref={(target) => buildHref(query, { page: target })}
      />

      {preview && (
        <PreviewDialog
          asset={preview}
          folderLabel={labelFor(preview.folder)}
          canDelete={canDelete}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}