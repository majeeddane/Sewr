import type { Metadata } from "next";
import { BlogCard } from "@/components/site/sections";
import { PageHero } from "@/components/site/common";
import { Pagination } from "@/components/admin/widgets";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/site/common";
import { publishDuePosts } from "@/lib/notifications";
import { getCategories, getPopularTags, getPublishedPosts, toPublicPost } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 300;

const PER_PAGE = 9;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "المدونة",
    description:
      "مقالات توعوية عن اضطراب الإدمان والتعافي ودور الأسرة، من مركز سوار وعي.",
    alternates: { canonical: "/blog" },
  };
}

export async function generateStaticParams() {
  // Pre-render the first pages; deeper pages render on demand.
  return Array.from({ length: 3 }, (_, i) => ({ page: String(i + 1) }));
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string; q?: string }>;
}) {
  // Any scheduled article whose time has come goes live now.
  await publishDuePosts();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const category = params.category;
  const tag = params.tag;
  const query = params.q?.trim();

  // Search needs its own query (searchText is a plain column), while
  // category/tag filtering is handled by the cached helper.
  let posts;
  if (query) {
    const rows = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        searchText: { contains: query.toLowerCase() },
      },
      include: {
        category: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    });
    posts = rows.map(toPublicPost);
  } else {
    posts = await getPublishedPosts({
      limit: PER_PAGE,
      categorySlug: category,
      tagSlug: tag,
    });
  }

  const total = query
    ? await prisma.post.count({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          searchText: { contains: query.toLowerCase() },
        },
      })
    : await prisma.post.count({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          ...(category ? { category: { slug: category } } : {}),
          ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
        },
      });

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const [categories, tags] = await Promise.all([getCategories(), getPopularTags(14)]);

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (nextPage > 1) qs.set("page", String(nextPage));
    if (category) qs.set("category", category);
    if (tag) qs.set("tag", tag);
    if (query) qs.set("q", query);
    const string = qs.toString();
    return string ? `/blog?${string}` : "/blog";
  };

  const activeFilterLabel = query
    ? `نتائج البحث عن «${query}»`
    : categories.find((c) => c.slug === category)?.name ??
      (tag ? `الوسم: ${tag}` : null);

  return (
    <>
      <PageHero
        eyebrow="المدونة"
        title="مقالات ومعرفة تهمّك"
        description="نشارك ما تعلّمناه عن اضطراب الإدمان والتعافي ودور الأسرة، بلغة واضحة ومفهومة، دون وصم ولا مبالغة."
        crumbs={[{ label: "المدونة" }]}
        compact
      />

      {/* Filters */}
      <section className="border-b border-sand-200 bg-sand-50 py-7">
        <div className="container-page flex flex-col gap-5">
          <form action="/blog" method="get" className="flex gap-2.5">
            {category && <input type="hidden" name="category" value={category} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <label htmlFor="blog-search" className="sr-only">
              ابحث في المدونة
            </label>
            <input
              id="blog-search"
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder="ابحث في المقالات…"
              className="h-12 flex-1 rounded-full border border-sand-300 bg-white px-5 text-[0.9375rem] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-brand-800 px-7 text-[0.9375rem] font-bold text-white transition-colors hover:bg-brand-900"
            >
              بحث
            </button>
          </form>

          <nav aria-label="تصنيفات المدونة" className="flex flex-wrap items-center gap-2">
            <FilterChip href="/blog" active={!category && !tag && !query}>
              الكل
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                href={`/blog?category=${c.slug}`}
                active={category === c.slug}
              >
                {c.name}
                <span className="ms-1.5 opacity-60">{c._count.posts}</span>
              </FilterChip>
            ))}
          </nav>

          {tags.length > 0 && (
            <nav aria-label="وسوم المقالات" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-400">وسوم:</span>
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/blog?tag=${t.slug}`}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                    tag === t.slug
                      ? "bg-gold-500 text-brand-950"
                      : "bg-white text-ink-600 ring-1 ring-inset ring-sand-300 hover:bg-brand-50",
                  )}
                >
                  {t.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* Articles */}
      <section className="py-14 sm:py-16">
        <div className="container-page">
          {activeFilterLabel && (
            <p className="mb-8 text-sm font-bold text-brand-800">
              {activeFilterLabel} — {total} مقال
            </p>
          )}

          {posts.length === 0 ? (
            <EmptyState
              title="لا توجد مقالات مطابقة"
              description="جرّب كلمة بحث مختلفة، أو تصفّح كل التصنيفات."
              action={
                <Link
                  href="/blog"
                  className="mt-2 inline-flex h-10 items-center rounded-full bg-brand-800 px-5 text-sm font-bold text-white"
                >
                  عرض كل المقالات
                </Link>
              }
            />
          ) : (
            <>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, index) => (
                  <Reveal as="li" key={post.id} delay={(index % 3) * 80}>
                    <BlogCard post={post} />
                  </Reveal>
                ))}
              </ul>

              {pageCount > 1 && (
                <div className="mt-12">
                  <Pagination
                    page={page}
                    pageCount={pageCount}
                    total={total}
                    buildHref={buildHref}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full px-4 py-2 text-[0.8125rem] font-bold transition-colors",
        active
          ? "bg-brand-800 text-white"
          : "bg-white text-ink-600 ring-1 ring-inset ring-sand-300 hover:bg-brand-50 hover:text-brand-800",
      )}
    >
      {children}
    </Link>
  );
}
