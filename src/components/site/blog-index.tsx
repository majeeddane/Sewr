"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BlogCard } from "@/components/site/sections";
import { EmptyState } from "@/components/site/common";
import { Pagination } from "@/components/admin/widgets";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/**
 * The blog index, with search, category and tag filtering.
 *
 * This is a client component on purpose. The server page fetches every
 * published article once and is prerendered like the rest of the site, so
 * visiting /blog costs a CDN read instead of a database round trip. The
 * database sits in another region from the deployment, and that round trip was
 * measured at well over three seconds — this makes it instant.
 *
 * The URL is kept in sync so a filtered view stays shareable and the back
 * button behaves, and filtering still works for someone arriving on
 * /blog?category=… from a search engine.
 *
 * This is only appropriate because the archive is small. If the blog ever grows
 * past a few hundred articles, move filtering back to the server and accept the
 * latency, or paginate from a cached index.
 */

const PER_PAGE = 9;

export interface BlogIndexPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  coverHidden: boolean;
  publishedAt: string;
  readingMinutes: number;
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
}

export interface BlogIndexCategory {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export interface BlogIndexTag {
  id: string;
  name: string;
  slug: string;
}

/** Strips markup so a query matches the article body, not its tags. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function BlogIndex({
  posts,
  categories,
  tags,
}: {
  posts: BlogIndexPost[];
  categories: BlogIndexCategory[];
  tags: BlogIndexTag[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const query = (searchParams.get("q") ?? "").trim();

  /*
   * The input is uncontrolled between submits. When the URL changes from
   * outside — a chip, the back button, a shared link — the `key` below remounts
   * the field with the new value. Syncing it with an effect instead would cause
   * a second render pass on every keystroke.
   */
  const [draft, setDraft] = React.useState(query);

  // Pre-computed searchable text, so typing does not re-strip markup per keystroke.
  const haystacks = React.useMemo(
    () =>
      posts.map((post) =>
        plainText(`${post.title} ${post.excerpt} ${post.content} ${post.category?.name ?? ""}`),
      ),
    [posts],
  );

  const filtered = React.useMemo(() => {
    const needle = query.toLowerCase();
    return posts.filter((post, i) => {
      if (category && post.category?.slug !== category) return false;
      if (tag && !post.tags.some((t) => t.slug === tag)) return false;
      if (needle && !haystacks[i]?.includes(needle)) return false;
      return true;
    });
  }, [posts, haystacks, category, tag, query]);

  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  /** Rewrites the query string without scrolling or re-running a server render. */
  const applyFilters = React.useCallback(
    (next: { category?: string; tag?: string; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Any filter change returns to the first page of results.
      params.delete("page");

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters({ q: draft });
  };

  const activeLabel = query
    ? `نتائج البحث عن «${query}»`
    : (categories.find((c) => c.slug === category)?.name ??
      (tag ? `الوسم: ${tag}` : null));

  return (
    <>
      {/* ── Filters ─────────────────────────────────── */}
      <section className="border-b border-sand-200 bg-sand-50 py-7">
        <div className="container-page flex flex-col gap-5">
          {/*
            method/action keep the field working without JavaScript: the form
            falls back to a plain GET and the page filters on load.
          */}
          <form onSubmit={onSubmit} method="get" action={pathname} className="flex gap-2.5">
            <label htmlFor="blog-search" className="sr-only">
              ابحث في المدونة
            </label>
            {category && <input type="hidden" name="category" value={category} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <input
              key={query}
              id="blog-search"
              name="q"
              type="search"
              defaultValue={query}
              onChange={(e) => setDraft(e.target.value)}
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
            <FilterChip
              onClick={() => applyFilters({ category: "", tag: "", q: "" })}
              active={!category && !tag && !query}
            >
              الكل
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                onClick={() => applyFilters({ category: category === c.slug ? "" : c.slug, tag: "" })}
                active={category === c.slug}
              >
                {c.name}
                <span className="ms-1.5 opacity-60">{c.postCount}</span>
              </FilterChip>
            ))}
          </nav>

          {tags.length > 0 && (
            <nav aria-label="وسوم المقالات" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-ink-400">وسوم:</span>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyFilters({ tag: tag === t.slug ? "" : t.slug, category: "" })}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                    tag === t.slug
                      ? "bg-gold-500 text-brand-950"
                      : "bg-white text-ink-600 ring-1 ring-inset ring-sand-300 hover:bg-brand-50",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* ── Articles ────────────────────────────────── */}
      <section className="py-14 sm:py-16">
        <div className="container-page">
          {activeLabel && (
            <p className="mb-8 text-sm font-bold text-brand-800">
              {activeLabel} — {filtered.length} مقال
            </p>
          )}

          {visible.length === 0 ? (
            <EmptyState
              title="لا توجد مقالات مطابقة"
              description="جرّب كلمة بحث مختلفة، أو تصفّح كل التصنيفات."
              action={
                <button
                  type="button"
                  onClick={() => applyFilters({ category: "", tag: "", q: "" })}
                  className="mt-2 inline-flex h-10 items-center rounded-full bg-brand-800 px-5 text-sm font-bold text-white"
                >
                  عرض كل المقالات
                </button>
              }
            />
          ) : (
            <>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {visible.map((post, index) => (
                  <Reveal as="li" key={post.id} delay={(index % 3) * 80}>
                    <BlogCard post={post as never} />
                  </Reveal>
                ))}
              </ul>

              {pageCount > 1 && (
                <div className="mt-12">
                  <Pagination
                    page={current}
                    pageCount={pageCount}
                    total={filtered.length}
                    buildHref={buildPageHref}
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
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full px-4 py-2 text-[0.8125rem] font-bold transition-colors",
        active
          ? "bg-brand-800 text-white"
          : "bg-white text-ink-600 ring-1 ring-inset ring-sand-300 hover:bg-brand-50 hover:text-brand-800",
      )}
    >
      {children}
    </button>
  );
}