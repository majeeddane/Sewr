"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Copy,
  Eye,
  Link2,
  Pencil,
  RefreshCw,
  Search,
  Timer,
} from "lucide-react";
import { DataTable, Pagination, type Column } from "@/components/admin/widgets";
import { Badge, Button, ButtonLink } from "@/components/ui/primitives";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { toast } from "@/components/ui/toast";
import { deletePost, duplicatePost, togglePublish } from "@/app/admin/(dashboard)/posts/actions";
import { POST_STATUS_LABELS, type PostStatus } from "@/lib/enums";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  views: number;
  readingMinutes: number;
  featuredOnHome: boolean;
  noIndex: boolean;
  categoryName: string | null;
  authorName: string | null;
  tags: string[];
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, "success" | "warn" | "sand"> = {
  PUBLISHED: "success",
  SCHEDULED: "warn",
  DRAFT: "sand",
};

function safeStatus(value: string): PostStatus {
  return value === "PUBLISHED" || value === "SCHEDULED" ? value : "DRAFT";
}

const SORT_OPTIONS = [
  { value: "newest", label: "الأحدث أولًا" },
  { value: "oldest", label: "الأقدم أولًا" },
  { value: "scheduled", label: "الأقرب جدولة" },
  { value: "views", label: "الأكثر مشاهدة" },
  { value: "title", label: "العنوان (أ–ي)" },
  { value: "updated", label: "آخر تعديل" },
] as const;

export function PostList({
  rows,
  categories,
  total,
  page,
  pageCount,
  query,
}: {
  rows: PostRow[];
  categories: CategoryOption[];
  total: number;
  page: number;
  pageCount: number;
  query: { q: string; status: string; category: string; sort: string };
}) {
  const router = useRouter();
  const { run, pending } = useAction();

  // `query` comes from the URL, so the input follows it. The "adjust state
  // while rendering" pattern (instead of an effect) avoids an extra paint and
  // keeps the field correct on back/forward navigation.
  const [search, setSearch] = React.useState(query.q);
  const [syncedQ, setSyncedQ] = React.useState(query.q);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    setSearch(query.q);
  }

  const href = React.useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams();
      if (query.q) params.set("q", query.q);
      if (query.status) params.set("status", query.status);
      if (query.category) params.set("category", query.category);
      if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
      if (nextPage > 1) params.set("page", String(nextPage));
      const qs = params.toString();
      return qs ? `/admin/posts?${qs}` : "/admin/posts";
    },
    [query],
  );

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/blog/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط المقال.", url);
    } catch {
      toast.error("تعذّر النسخ.", url);
    }
  };

  const columns: Column<PostRow>[] = [
    {
      key: "cover",
      header: "صورة",
      className: "w-16",
      cell: (row) =>
        row.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.coverImage}
            alt=""
            className="size-12 rounded-lg object-cover ring-1 ring-sand-200 dark:ring-white/10"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-lg bg-sand-100 text-[0.625rem] font-bold text-ink-400 dark:bg-white/10"
          >
            لا صورة
          </span>
        ),
    },
    {
      key: "title",
      header: "العنوان",
      cell: (row) => {
        const status = safeStatus(row.status);
        return (
          <div className="min-w-0 max-w-md">
            <p className="truncate font-extrabold text-brand-900 dark:text-white">{row.title}</p>
            <p className="mt-0.5 truncate text-xs text-ink-400" dir="ltr">
              /blog/{row.slug}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {row.featuredOnHome && <Badge tone="gold">مميّز</Badge>}
              {row.noIndex && <Badge tone="outline">ممنوع من الفهرسة</Badge>}
              {row.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sand-100 px-2 py-0.5 text-[0.625rem] font-bold text-ink-600 dark:bg-white/10 dark:text-ink-300"
                >
                  #{tag}
                </span>
              ))}
              {row.tags.length > 3 && (
                <span className="text-[0.625rem] font-bold text-ink-400">
                  +{row.tags.length - 3}
                </span>
              )}
            </div>

            {status === "SCHEDULED" && row.scheduledAt && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn-50 px-2.5 py-1 text-[0.6875rem] font-bold text-warn-700 ring-1 ring-inset ring-warn-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
                <CalendarClock className="size-3" aria-hidden />
                ينشر تلقائيًا في {formatDateTime(row.scheduledAt)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "category",
      header: "التصنيف",
      hideBelow: "md",
      cell: (row) =>
        row.categoryName ? (
          <Badge tone="brand">{row.categoryName}</Badge>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => (
        <Badge tone={STATUS_TONE[safeStatus(row.status)] ?? "sand"}>
          {POST_STATUS_LABELS[safeStatus(row.status)]}
        </Badge>
      ),
    },
    {
      key: "publishedAt",
      header: "تاريخ النشر",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
          {row.publishedAt ? formatDateTime(row.publishedAt) : "—"}
        </span>
      ),
    },
    {
      key: "scheduledAt",
      header: "المجدول لـ",
      hideBelow: "lg",
      cell: (row) =>
        row.status === "SCHEDULED" && row.scheduledAt ? (
          <span className="whitespace-nowrap text-xs font-bold text-warn-700 dark:text-amber-200">
            {formatDateTime(row.scheduledAt)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "views",
      header: "المشاهدات",
      hideBelow: "xl",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-600 dark:text-ink-300">
          <Eye className="size-3.5 text-ink-400" aria-hidden />
          {formatNumber(row.views)}
        </span>
      ),
    },
    {
      key: "reading",
      header: "وقت القراءة",
      hideBelow: "xl",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-ink-600 dark:text-ink-300">
          <Timer className="size-3.5 text-ink-400" aria-hidden />
          {formatNumber(row.readingMinutes)} د
        </span>
      ),
    },
    {
      key: "actions",
      header: "إجراءات",
      className: "w-56",
      cell: (row) => {
        const published = safeStatus(row.status) === "PUBLISHED";
        return (
          <div
            className="flex flex-wrap items-center gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              href={`/admin/posts/${row.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-sand-100 px-2.5 text-[0.6875rem] font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
            >
              <Pencil className="size-3" aria-hidden />
              تعديل
            </Link>

            <button
              type="button"
              onClick={() => void copyLink(row.slug)}
              title="نسخ رابط المقال"
              className="inline-flex h-8 items-center gap-1 rounded-full bg-sand-100 px-2.5 text-[0.6875rem] font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
            >
              <Link2 className="size-3" aria-hidden />
              نسخ رابط
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() => togglePublish(row.id), {
                  successMessage: published ? "أُعيد المقال إلى المسودات." : "تم نشر المقال.",
                })
              }
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-bold ring-1 ring-inset transition-colors disabled:opacity-50",
                published
                  ? "bg-warn-50 text-warn-700 ring-warn-100 hover:bg-warn-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30"
                  : "bg-success-50 text-success-700 ring-success-100 hover:bg-success-100",
              )}
            >
              {published ? "إلغاء نشر" : "نشر"}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(() => duplicatePost(row.id), {
                  successMessage: "تم إنشاء نسخة كمسودة.",
                  onSuccess: () => router.refresh(),
                })
              }
              title="إنشاء نسخة"
              className="inline-flex size-8 items-center justify-center rounded-full bg-sand-100 text-ink-600 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 disabled:opacity-50 dark:bg-white/10 dark:text-ink-300 dark:ring-white/10"
            >
              <Copy className="size-3" aria-hidden />
              <span className="sr-only">إنشاء نسخة</span>
            </button>

            <ConfirmButton
              size="sm"
              className="px-2.5 py-1.5 text-[0.6875rem]"
              onConfirm={async () => {
                await run(() => deletePost(row.id), { successMessage: "تم حذف المقال." });
              }}
              message={`سيُحذف «${row.title}» نهائيًا. هل أنت متأكد؟`}
            >
              حذف
            </ConfirmButton>
          </div>
        );
      },
    },
  ];

  const hasFilters = Boolean(query.q || query.status || query.category || query.sort !== "newest");

  return (
    <>
      {/* ── Filters (plain GET form — works without JS) ── */}
      <form
        method="get"
        action="/admin/posts"
        className="mb-5 flex flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-white/5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <label htmlFor="post-q" className="mb-1.5 block text-xs font-bold text-ink-700 dark:text-ink-200">
              بحث
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute bottom-3.5 start-3.5 size-4 text-ink-400"
            />
            <input
              id="post-q"
              type="search"
              name="q"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث في العنوان والمقتطف…"
              className="h-11 w-full rounded-xl border border-sand-300 bg-white ps-10 pe-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-100"
            />
          </div>

          <div className="w-full lg:w-44">
            <label htmlFor="post-status" className="mb-1.5 block text-xs font-bold text-ink-700 dark:text-ink-200">
              الحالة
            </label>
            <select
              id="post-status"
              name="status"
              defaultValue={query.status}
              className="h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-100"
            >
              <option value="">كل الحالات</option>
              <option value="PUBLISHED">منشور</option>
              <option value="SCHEDULED">مجدول</option>
              <option value="DRAFT">مسودة</option>
            </select>
          </div>

          <div className="w-full lg:w-44">
            <label htmlFor="post-category" className="mb-1.5 block text-xs font-bold text-ink-700 dark:text-ink-200">
              التصنيف
            </label>
            <select
              id="post-category"
              name="category"
              defaultValue={query.category}
              className="h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-100"
            >
              <option value="">كل التصنيفات</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full lg:w-48">
            <label htmlFor="post-sort" className="mb-1.5 block text-xs font-bold text-ink-700 dark:text-ink-200">
              الترتيب
            </label>
            <select
              id="post-sort"
              name="sort"
              defaultValue={query.sort}
              className="h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-100"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" icon={Search}>
              تصفية
            </Button>
            {hasFilters && (
              <ButtonLink href="/admin/posts" size="sm" variant="outline" icon={RefreshCw}>
                إعادة تعيين
              </ButtonLink>
            )}
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/posts/${row.id}`)}
        empty={
          query.q || query.status || query.category
            ? "لا توجد مقالات مطابقة للفلاتر."
            : "لا توجد مقالات بعد. ابدأ بكتابة أول مقال."
        }
        footer={
          rows.length > 0 ? (
            <span className="text-xs text-ink-500">
              <strong>{formatNumber(total)}</strong> مقال · اضغط على أي صف لفتحه.
            </span>
          ) : null
        }
      />

      <div className="mt-5">
        <Pagination page={page} pageCount={pageCount} total={total} buildHref={href} />
      </div>
    </>
  );
}