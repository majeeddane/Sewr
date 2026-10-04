import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Suspense } from "react";
import Link from "next/link";
import { Newspaper, Plus, CalendarClock, FileEdit, Eye, Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/shell";
import { StatCard } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";
import { PostList, type PostRow } from "@/components/admin/posts/post-list";
import { publishDuePosts } from "@/lib/notifications";
import { formatDateTime, formatNumber, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المدونة" };

const PAGE_SIZE = 20;

type SortKey =
  | "newest"
  | "oldest"
  | "scheduled"
  | "views"
  | "title"
  | "updated";

const SORTS: Record<SortKey, Prisma.PostOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  oldest: [{ publishedAt: "asc" }, { createdAt: "asc" }],
  scheduled: [{ scheduledAt: "asc" }],
  views: [{ views: "desc" }],
  title: [{ title: "asc" }],
  updated: [{ updatedAt: "desc" }],
};

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Latest SCHEDULED cards, fetched by the page and handed to a Suspense child. */
async function ScheduledStrip() {
  const scheduled = await prisma.post.findMany({
    where: { status: "SCHEDULED" },
    orderBy: { scheduledAt: "asc" },
    take: 4,
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      category: { select: { name: true } },
    },
  });

  if (scheduled.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gold-200 bg-gold-50/60 shadow-soft dark:border-amber-500/25 dark:bg-amber-500/10">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-200 px-5 py-3.5 dark:border-amber-500/25">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-brand-900 dark:text-white">
          <CalendarClock className="size-4 text-gold-600" aria-hidden />
          مقالات مجدولة للنشر التلقائي
        </h2>
        <Link
          href="/admin/posts?status=SCHEDULED"
          className="text-xs font-bold text-brand-700 hover:underline dark:text-gold-200"
        >
          عرض الكل
        </Link>
      </header>
      <ul className="grid gap-3 p-4 sm:grid-cols-2">
        {scheduled.map((post) => (
          <li key={post.id}>
            <Link
              href={`/admin/posts/${post.id}`}
              className="group flex h-full flex-col gap-1.5 rounded-xl border border-gold-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-soft dark:border-amber-500/20 dark:bg-white/5"
            >
              <span className="text-sm font-extrabold text-brand-900 group-hover:text-brand-700 dark:text-white">
                {post.title}
              </span>
              <span className="text-xs font-bold text-warn-700 dark:text-amber-200">
                ينشر في {post.scheduledAt ? formatDateTime(post.scheduledAt) : "—"}
              </span>
              {post.category && (
                <span className="text-[0.6875rem] text-ink-500 dark:text-ink-400">
                  التصنيف: {post.category.name}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-gold-200 px-5 py-2.5 text-xs leading-relaxed text-ink-600 dark:border-amber-500/25 dark:text-ink-300">
        هذه المقالات تظهر تلقائيًا في الموقع عند حلول موعدها، دون أي تدخل منك.
      </p>
    </section>
  );
}

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Anything whose scheduled moment has passed goes live first.
  await publishDuePosts();

  const params = await searchParams;
  const q = one(params.q).trim();
  const status = one(params.status).trim().toUpperCase();
  const categoryId = one(params.category).trim();
  const sortParam = one(params.sort).trim();
  const sort: SortKey = (sortParam in SORTS ? sortParam : "newest") as SortKey;
  const page = Math.max(1, Number(one(params.page)) || 1);

  const where: Prisma.PostWhereInput = {
    ...(status === "DRAFT" || status === "SCHEDULED" || status === "PUBLISHED"
      ? { status }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            // SQLite's `contains` is case-sensitive for ASCII, so the lower-cased
            // `searchText` column carries the match.
            { title: { contains: q } },
            { searchText: { contains: q.toLowerCase() } },
            { slug: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [total, posts, categories, publishedCount, scheduledCount, draftCount, viewsAgg] =
    await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy: SORTS[sort],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          category: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { name: true } } } },
        },
      }),
      prisma.category.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "SCHEDULED" } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.post.aggregate({ _sum: { views: true } }),
    ]);

  const rows: PostRow[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: truncate(post.excerpt, 120),
    coverImage: post.coverImage,
    status: post.status,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
    views: post.views,
    readingMinutes: post.readingMinutes,
    featuredOnHome: post.featuredOnHome,
    noIndex: post.noIndex,
    categoryName: post.category?.name ?? null,
    authorName: post.author?.name ?? null,
    tags: post.tags.map((entry) => entry.tag.name),
    updatedAt: post.updatedAt.toISOString(),
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="المدونة"
        description="اكتب المقالات، انشرها أو جدولها، وتابع أداءها من مكان واحد."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/posts", label: "المدونة" },
        ]}
        action={
          <>
            <ButtonLink href="/admin/categories" variant="outline" size="sm" icon={Tags}>
              التصنيفات
            </ButtonLink>
            <ButtonLink href="/admin/posts/new" variant="primary" size="sm" icon={Plus}>
              مقال جديد
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مقالات منشورة"
          value={publishedCount}
          hint="ظاهرة في صفحة المدونة"
          icon={Newspaper}
          href="/admin/posts?status=PUBLISHED"
        />
        <StatCard
          label="مجدولة للنشر"
          value={scheduledCount}
          hint="تنشر تلقائيًا عند موعدها"
          icon={CalendarClock}
          tone="warn"
          href="/admin/posts?status=SCHEDULED"
        />
        <StatCard
          label="مسودات"
          value={draftCount}
          hint="قيد الإعداد"
          icon={FileEdit}
          tone="info"
          href="/admin/posts?status=DRAFT"
        />
        <StatCard
          label="إجمالي المشاهدات"
          value={viewsAgg._sum.views ?? 0}
          hint={`عبر ${formatNumber(total)} مقال مطابق للفلاتر`}
          icon={Eye}
          tone="success"
        />
      </div>

      <Suspense fallback={null}>
        <ScheduledStrip />
      </Suspense>

      <PostList
        rows={rows}
        categories={categories}
        total={total}
        page={page}
        pageCount={pageCount}
        query={{
          q,
          status: ["DRAFT", "SCHEDULED", "PUBLISHED"].includes(status) ? status : "",
          category: categoryId,
          sort: sortParam || "newest",
        }}
      />
    </>
  );
}