"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Filter bar for the beneficiaries list.
 *
 * The bar is a controlled client component that rewrites the query string, so
 * the URL stays the single source of truth (shareable, back-button friendly).
 * Every value arrives as a prop from the server, which keeps the component out
 * of `useSearchParams` and therefore out of any static-rendering bail-out.
 */

export interface FilterOption {
  value: string;
  label: string;
}

const SORT_OPTIONS: FilterOption[] = [
  { value: "newest", label: "الأحدث أولًا" },
  { value: "oldest", label: "الأقدم أولًا" },
  { value: "name", label: "الاسم (أبجديًا)" },
  { value: "status", label: "الحالة" },
];

export interface ClientFiltersProps {
  q: string;
  status: string;
  source: string;
  assigned: string;
  sort: string;
  statuses: FilterOption[];
  sources: FilterOption[];
  assignees: FilterOption[];
  /** Present only when the current request is a `?export=csv` request. */
  exportFile?: { filename: string; text: string; count: number } | null;
}

export function ClientFilters({
  q,
  status,
  source,
  assigned,
  sort,
  statuses,
  sources,
  assignees,
  exportFile = null,
}: ClientFiltersProps) {
  const router = useRouter();
  const [term, setTerm] = React.useState(q);
  const [syncedQ, setSyncedQ] = React.useState(q);

  // Keep the box in sync when the user navigates with the browser buttons.
  // Adjusting state during render (React's documented pattern) avoids the extra
  // render pass an effect would cost.
  if (q !== syncedQ) {
    setSyncedQ(q);
    setTerm(q);
  }

  const href = React.useCallback(
    (patch: Record<string, string | null>) => {
      const merged: Record<string, string> = { q, status, source, assigned, sort };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") delete merged[key];
        else merged[key] = value;
      }
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        if (value) params.set(key, value);
      }
      const query = params.toString();
      return query ? `/admin/clients?${query}` : "/admin/clients";
    },
    [q, status, source, assigned, sort],
  );

  const go = React.useCallback(
    (patch: Record<string, string | null>) => {
      router.push(href(patch));
    },
    [href, router],
  );

  const hasFilters = Boolean(q || status || source || assigned);

  return (
    <form
      role="search"
      aria-label="تصفية المستفيدين"
      onSubmit={(event) => {
        event.preventDefault();
        go({ q: term, page: null });
      }}
      className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/5"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="relative">
          <label htmlFor="clients-q" className="sr-only">
            بحث في المستفيدين
          </label>
          <Input
            id="clients-q"
            name="q"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="ابحث بالاسم أو الجوال أو البريد أو المدينة…"
            iconStart={<Search className="size-4" />}
            className="h-11 text-sm"
          />
        </div>

        <Select
          aria-label="الحالة"
          name="status"
          value={status}
          onChange={(event) => go({ status: event.target.value || null, page: null })}
          className="h-11 text-sm"
        >
          <option value="">كل الحالات</option>
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="مصدر الطلب"
          name="source"
          value={source}
          onChange={(event) => go({ source: event.target.value || null, page: null })}
          className="h-11 text-sm"
        >
          <option value="">كل المصادر</option>
          {sources.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="المسؤول عن الملف"
          name="assigned"
          value={assigned}
          onChange={(event) => go({ assigned: event.target.value || null, page: null })}
          className="h-11 text-sm"
        >
          <option value="">كل المسئولين</option>
          <option value="unassigned">غير مُسند</option>
          {assignees.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="الترتيب"
          name="sort"
          value={sort || "newest"}
          onChange={(event) => go({ sort: event.target.value, page: null })}
          className="h-11 text-sm"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-2 md:col-span-2 xl:col-span-1">
          <Button type="submit" size="sm" icon={Filter} className="h-11 shrink-0">
            تصفية
          </Button>
          {hasFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={RotateCcw}
              className="h-11 shrink-0"
              onClick={() => {
                setTerm("");
                router.push("/admin/clients");
              }}
            >
              مسح
            </Button>
          )}
        </div>
      </div>

      {exportFile && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-3 dark:border-white/10">
          <p className="text-xs leading-relaxed text-ink-500">
            تم تجهيز ملف Excel يحتوي على <strong>{exportFile.count}</strong> سجل مع الأرقام
            والبريد مفكوكة التعمية.
          </p>
          <CsvDownload filename={exportFile.filename} text={exportFile.text} />
        </div>
      )}
    </form>
  );
}

/**
 * Turns an already-built `text/csv` payload (UTF-8 BOM included, prepared on the
 * server) into a browser download. The server owns the data; this only hands
 * the bytes to the user.
 */
export function CsvDownload({
  filename,
  text,
  className,
  label = "تنزيل ملف Excel",
}: {
  filename: string;
  text: string;
  className?: string;
  label?: string;
}) {
  const download = React.useCallback(() => {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filename, text]);

  return (
    <Button
      type="button"
      variant="gold"
      size="sm"
      icon={Download}
      className={cn(className)}
      onClick={download}
    >
      {label}
    </Button>
  );
}
