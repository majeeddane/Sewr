"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Inbox, Mail, MailOpen, Reply, Search, X } from "lucide-react";
import { Pagination } from "@/components/admin/widgets";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Master side of the inbox.
 *
 * The whole component is a set of links + one GET form, so every filter and
 * page lives in the URL and the detail pane can be shared/bookmarked. Rows
 * only ever carry display strings — the server decrypts and masks before
 * serialising them.
 */

export const MESSAGE_FILTERS = ["all", "unread", "replied", "archived"] as const;
export type MessageFilter = (typeof MESSAGE_FILTERS)[number];

export interface MessageListItem {
  id: string;
  name: string;
  subject: string | null;
  topic: string | null;
  /** Already masked server-side, e.g. "•••••6789". */
  phoneMasked: string;
  hasEmail: boolean;
  isRead: boolean;
  isArchived: boolean;
  repliedAt: string | null;
  createdAt: string;
}

export interface MessageCounts {
  all: number;
  unread: number;
  replied: number;
  archived: number;
}

const FILTER_LABELS: Record<MessageFilter, string> = {
  all: "كل الرسائل",
  unread: "غير المقروءة",
  replied: "تم الرد عليها",
  archived: "الأرشيف",
};

const FILTER_ICONS: Record<MessageFilter, React.ComponentType<{ className?: string }>> = {
  all: Inbox,
  unread: Mail,
  replied: Reply,
  archived: Archive,
};

function buildHref(
  base: { path: string; filter: MessageFilter; q: string },
  overrides: { filter?: MessageFilter; q?: string; page?: number; id?: string } = {},
): string {
  const filter = overrides.filter ?? base.filter;
  const q = overrides.q ?? base.q;
  const page = overrides.page ?? 1;
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  if (overrides.id) params.set("id", overrides.id);
  const query = params.toString();
  return query ? `${base.path}?${query}` : base.path;
}

export function MessageList({
  items,
  counts,
  filter,
  q,
  page,
  pageCount,
  total,
  activeId,
  basePath = "/admin/messages",
}: {
  items: MessageListItem[];
  counts: MessageCounts;
  filter: MessageFilter;
  q: string;
  page: number;
  pageCount: number;
  total: number;
  activeId: string | null;
  basePath?: string;
}) {
  const base = React.useMemo(() => ({ path: basePath, filter, q }), [basePath, filter, q]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter tabs ─────────────────────────────── */}
      <nav aria-label="تصفية الرسائل" className="flex flex-wrap gap-2">
        {MESSAGE_FILTERS.map((value) => {
          const Icon = FILTER_ICONS[value];
          const active = value === filter;
          const count = counts[value];
          return (
            <Link
              key={value}
              href={buildHref(base, { filter: value, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                active
                  ? "bg-brand-800 text-white shadow-soft"
                  : "bg-sand-100 text-ink-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {FILTER_LABELS[value]}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem]",
                  active ? "bg-white/20" : "bg-white text-ink-500 dark:bg-white/10 dark:text-ink-400",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Search ─────────────────────────────────── */}
      <form action={basePath} method="get" className="flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-400"
          />
          <input
            key={`${filter}:${q}`}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم، الموضوع، التصنيف، الجوال أو البريد…"
            aria-label="بحث في الرسائل"
            className="h-10 w-full rounded-xl border border-sand-300 bg-white ps-9 pe-3 text-[0.8125rem] text-ink-800 shadow-sm transition-colors placeholder:text-ink-400 hover:border-sand-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/5 dark:text-ink-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900"
        >
          <Search className="size-3.5" aria-hidden />
          بحث
        </button>
        {q && (
          <Link
            href={buildHref(base, { q: "", page: 1 })}
            aria-label="مسح البحث"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-500 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/15"
          >
            <X className="size-4" aria-hidden />
          </Link>
        )}
      </form>

      {/* ── Rows ───────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <MailOpen className="size-8 text-ink-300" aria-hidden />
            <p className="text-sm font-bold text-ink-600 dark:text-ink-300">
              {q ? "لا توجد نتائج مطابقة للبحث." : "لا توجد رسائل في هذا التصنيف."}
            </p>
            {(q || filter !== "all") && (
              <Link
                href={buildHref(base, { filter: "all", q: "", page: 1 })}
                className="text-xs font-bold text-brand-700 hover:underline"
              >
                عرض كل الرسائل
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-sand-200 dark:divide-white/10">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <Link
                    href={buildHref(base, { id: item.id })}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 transition-colors",
                      active
                        ? "bg-brand-50 dark:bg-brand-500/10"
                        : "hover:bg-sand-50 dark:hover:bg-white/5",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 size-2 shrink-0 rounded-full",
                        item.isRead ? "bg-transparent" : "bg-danger-500",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm text-brand-900 dark:text-white",
                            item.isRead ? "font-bold" : "font-extrabold",
                          )}
                        >
                          {item.name}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-ink-400">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-600 dark:text-ink-300">
                        {item.subject || item.topic || "بدون موضوع"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-ink-400">
                        {item.phoneMasked ? (
                          <span dir="ltr" className="tracking-wide">
                            {item.phoneMasked}
                          </span>
                        ) : (
                          <span>بدون جوال</span>
                        )}
                        {item.hasEmail && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 dark:bg-white/10"
                            title="لدى المُرسِل بريد إلكتروني"
                          >
                            <Mail className="size-3" aria-hidden />
                            بريد
                          </span>
                        )}
                        {item.topic && (
                          <span className="rounded-full bg-sand-100 px-2 py-0.5 font-bold text-ink-600 dark:bg-white/10 dark:text-ink-300">
                            {item.topic}
                          </span>
                        )}
                        {item.repliedAt && (
                          <span className="rounded-full bg-success-50 px-2 py-0.5 font-bold text-success-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                            تم الرد
                          </span>
                        )}
                        {item.isArchived && (
                          <span className="rounded-full bg-warn-50 px-2 py-0.5 font-bold text-warn-700 dark:bg-amber-500/15 dark:text-amber-200">
                            مؤرشفة
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        buildHref={(target) => buildHref(base, { page: target })}
      />
    </div>
  );
}