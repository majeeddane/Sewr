import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

// ── Skeleton ───────────────────────────────────────────────────

/**
 * Placeholder block used by loading states.
 *
 * Dashboard pages are dynamic and each one waits on the database, so without a
 * skeleton the interface shows nothing at all during the round trip and reads
 * as frozen rather than loading.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-sand-200 dark:bg-white/8", className)}
    />
  );
}

// ── Stat card ─────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "brand",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "brand" | "gold" | "success" | "warn" | "info";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
    gold: "bg-gold-50 text-gold-700 dark:bg-gold-500/15 dark:text-gold-200",
    success:
      "bg-success-50 text-success-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    warn: "bg-warn-50 text-warn-700 dark:bg-amber-500/15 dark:text-amber-200",
    info: "bg-info-50 text-info-700 dark:bg-sky-500/15 dark:text-sky-200",
  } as const;

  const body = (
    <div className="group flex items-start justify-between gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card dark:border-white/10 dark:bg-white/5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[0.8125rem] font-bold text-ink-500 dark:text-ink-400">
          {label}
        </span>
        <span className="text-2xl font-extrabold text-brand-900 dark:text-white">
          {typeof value === "number" ? formatNumber(value) : value}
        </span>
        {hint && (
          <span className="text-xs leading-relaxed text-ink-400">{hint}</span>
        )}
      </div>
      {icon && (
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105",
            tones[tone],
          )}
        >
          <IconFallbackShim icon={icon} />
        </span>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function IconFallbackShim({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return <Icon className="size-5" />;
}

// ── Data table ────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hide on small screens. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  empty = "لا توجد بيانات لعرضها.",
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
  footer?: React.ReactNode;
}) {
  const hideClass = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
    xl: "hidden xl:table-cell",
  } as const;

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
        <Inbox className="size-8 text-ink-300" aria-hidden />
        <p className="font-bold text-ink-600 dark:text-ink-300">{empty}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-start">
          <thead>
            <tr className="border-b border-sand-200 bg-sand-50 dark:border-white/10 dark:bg-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3.5 text-start text-xs font-extrabold uppercase tracking-wide text-ink-500",
                    col.hideBelow && hideClass[col.hideBelow],
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200 dark:divide-white/10">
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "transition-colors hover:bg-sand-50 dark:hover:bg-white/5",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3.5 align-middle text-[0.875rem] text-ink-700 dark:text-ink-200",
                      col.hideBelow && hideClass[col.hideBelow],
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-sand-200 bg-sand-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────

export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return total > 0 ? (
      <p className="text-xs text-ink-500">إجمالي {formatNumber(total)} سجل</p>
    ) : null;
  }

  const window = 2;
  const pages: number[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= window) pages.push(i);
  }

  return (
    <nav
      aria-label="التنقل بين الصفحات"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-ink-500">
        صفحة {formatNumber(page)} من {formatNumber(pageCount)} — إجمالي{" "}
        {formatNumber(total)} سجل
      </p>
      <div className="flex items-center gap-1">
        <PageLink
          href={buildHref(Math.max(1, page - 1))}
          disabled={page <= 1}
          label="السابق"
          icon={ChevronRight}
        />
        {pages.map((p, index) => {
          const prev = pages[index - 1];
          const gap = prev !== undefined && p - prev > 1;
          return (
            <React.Fragment key={p}>
              {gap && <span className="px-1 text-ink-300">…</span>}
              <Link
                href={buildHref(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "grid size-9 place-items-center rounded-lg text-[0.8125rem] font-bold transition-colors",
                  p === page
                    ? "bg-brand-800 text-white"
                    : "text-ink-600 hover:bg-sand-200 dark:text-ink-300 dark:hover:bg-white/10",
                )}
              >
                {p}
              </Link>
            </React.Fragment>
          );
        })}
        <PageLink
          href={buildHref(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          label="التالي"
          icon={ChevronLeft}
        />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon: Icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const className =
    "inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[0.8125rem] font-bold transition-colors";
  if (disabled) {
    return (
      <span className={cn(className, "cursor-not-allowed text-ink-300 opacity-60")}>
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(className, "text-ink-600 hover:bg-sand-200 dark:hover:bg-white/10")}>
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

// ── Panel ─────────────────────────────────────────────────────

export function Panel({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-base font-extrabold text-brand-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

// ── Simple bar chart (no chart library) ────────────────────────

export function BarChart({
  data,
  height = 160,
  label,
}: {
  data: Array<{ label: string; values: number[] }>;
  height?: number;
  label?: string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const seriesColors = ["bg-brand-600", "bg-gold-400"];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-end gap-1"
        style={{ height }}
        role="img"
        aria-label={label ?? "رسم بياني"}
      >
        {data.map((d, index) => (
          <div
            key={`${d.label}-${index}`}
            className="group relative flex flex-1 flex-col justify-end gap-0.5"
            title={`${d.label}: ${d.values.join(" / ")}`}
          >
            {d.values.map((value, seriesIndex) => (
              <div
                key={seriesIndex}
                className={cn(
                  "w-full rounded-t-sm transition-all duration-500",
                  seriesColors[seriesIndex % seriesColors.length],
                )}
                style={{
                  height: `${Math.max(2, (value / max) * (height - 24))}px`,
                  opacity: value === 0 ? 0.25 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((d, index) => (
          <span
            key={`${d.label}-lbl-${index}`}
            className="flex-1 truncate text-center text-[0.625rem] text-ink-400"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
