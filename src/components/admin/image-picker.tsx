"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2, Link2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Image field used across the dashboard.
 *
 * Three ways to set a picture, because in practice the owner has different
 * needs at different times:
 *   1. upload a new file  → POST /api/admin/media
 *   2. pick from the library → /admin/media
 *   3. paste an existing URL  → keeps existing rows working without re-uploading
 */
export function ImagePicker({
  name,
  label,
  value,
  onChange,
  folder = "general",
  hint,
  className,
  aspect = "aspect-[16/9]",
}: {
  /** Form field name — the hidden input carries the current value. */
  name: string;
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  folder?: string;
  hint?: string;
  className?: string;
  aspect?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [urlMode, setUrlMode] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState(value ?? "");

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const res = await fetch("/api/admin/media", { method: "POST", body });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        asset?: { path: string };
      };
      if (!data.ok || !data.asset) {
        setError(data.message ?? "تعذّر رفع الصورة.");
        return;
      }
      onChange(data.asset.path);
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="flex items-center gap-1.5 text-sm font-bold text-ink-800">
        {label}
      </span>

      <input type="hidden" name={name} value={value ?? ""} />

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-dashed border-sand-300 bg-sand-50 transition-colors dark:border-white/15 dark:bg-white/5",
          aspect,
        )}
      >
        {value ? (
          <>
            <Image
              src={value}
              alt=""
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
              unoptimized={value.startsWith("http")}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-brand-950/45 opacity-0 backdrop-blur-[2px] transition-opacity focus-within:opacity-100 hover:opacity-100">
              <button
                type="button"
                onClick={() => setUrlMode(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-brand-800 shadow-soft"
              >
                <Link2 className="size-3.5" aria-hidden />
                تغيير الرابط
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-danger-600 px-3.5 py-2 text-xs font-bold text-white shadow-soft"
              >
                <Trash2 className="size-3.5" aria-hidden />
                إزالة
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-400 transition-colors hover:text-brand-700 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-6 animate-spin" aria-hidden />
                <span className="text-xs font-bold">جارٍ الرفع…</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-6" aria-hidden />
                <span className="text-xs font-bold">ارفع صورة أو أدخل رابطًا</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 disabled:opacity-60 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
        >
          <Upload className="size-3.5" aria-hidden />
          {uploading ? "جارٍ الرفع…" : "رفع ملف"}
        </button>
        <button
          type="button"
          onClick={() => setUrlMode((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
        >
          <Link2 className="size-3.5" aria-hidden />
          {urlMode ? "إخفاء الرابط" : "إدخال رابط"}
        </button>
        {value && (
          <span className="truncate text-[0.6875rem] text-ink-400" dir="ltr">
            {value}
          </span>
        )}
      </div>

      {urlMode && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            dir="ltr"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            placeholder="https://example.com/image.jpg"
            className="h-10 flex-1 rounded-xl border border-sand-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-white/10"
          />
          <button
            type="button"
            onClick={() => {
              onChange(urlDraft.trim() || null);
              setUrlMode(false);
            }}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-brand-800 px-4 text-xs font-bold text-white"
          >
            <X className="size-3.5 rotate-45" aria-hidden />
            اعتماد
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[0.8125rem] font-semibold text-danger-600">
          {error}
        </p>
      )}
      {hint && !error && <p className="text-[0.8125rem] text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * Smaller variant for card grids — clicking a tile returns its path.
 * Used by the service / program editors.
 */
export function ImageTile({
  src,
  alt,
  active,
  onSelect,
  onDelete,
  className,
}: {
  src: string;
  alt?: string | null;
  active?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 transition-all",
        active ? "border-brand-600 shadow-soft" : "border-transparent hover:border-sand-300",
        className,
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full"
        aria-pressed={active}
      >
        <span className="relative block aspect-[4/3] w-full">
          <Image
            src={src}
            alt={alt ?? ""}
            fill
            sizes="200px"
            className="object-cover"
            unoptimized={src.startsWith("http")}
          />
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="حذف الصورة"
          className="absolute start-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-white/90 text-danger-600 opacity-0 shadow-soft transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
