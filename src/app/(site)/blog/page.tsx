import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/site/common";
import { BlogIndex, type BlogIndexPost } from "@/components/site/blog-index";
import { getCategories, getPopularTags, getPublishedPosts } from "@/lib/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "المدونة",
    description:
      "مقالات توعوية عن اضطراب الإدمان والتعافي ودور الأسرة، من مركز سوار وعي.",
    alternates: { canonical: "/blog" },
  };
}

export default async function BlogPage() {
  /*
   * Scheduled articles are published by the daily cron at /api/cron/publish,
   * not here. Writing on every page view used to make /blog the slowest route
   * by an order of magnitude.
   *
   * This page deliberately does NOT read `searchParams`. That single await is
   * what marks a route as dynamic in the App Router, and because the database
   * sits in another region from the deployment, every visit to /blog paid a
   * multi-second round trip — while every other page was served from the edge
   * in about 90ms. Filtering now happens in the browser, so the route is
   * prerendered like the rest of the site and the query string still works.
   */
  const [posts, categories, tags] = await Promise.all([
    // A generous ceiling rather than a page of nine: the client paginates.
    getPublishedPosts({ limit: 200 }),
    getCategories(),
    getPopularTags(14),
  ]);

  return (
    <>
      <PageHero
        eyebrow="المدونة"
        title="مقالات ومعرفة تهمّك"
        description="نشارك ما تعلّمناه عن اضطراب الإدمان والتعافي ودور الأسرة، بلغة واضحة ومفهومة، دون وصم ولا مبالغة."
        crumbs={[{ label: "المدونة" }]}
        compact
      />

      {/* useSearchParams needs a boundary, so the filters hydrate on the client. */}
      <Suspense fallback={<BlogFallback />}>
        <BlogIndex
          posts={posts.map(
            (post) =>
              ({
                id: post.id,
                slug: post.slug,
                title: post.title,
                excerpt: post.excerpt,
                content: post.content,
                coverImage: post.coverImage,
                coverHidden: post.coverHidden,
                publishedAt: (post.publishedAt ?? new Date()).toISOString(),
                readingMinutes: post.readingMinutes,
                category: post.category,
                tags: post.tags,
              }) satisfies BlogIndexPost,
          )}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            postCount: c._count.posts,
          }))}
          tags={tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
        />
      </Suspense>
    </>
  );
}

/** Keeps the layout stable while the filters hydrate. */
function BlogFallback() {
  return (
    <>
      <section className="border-b border-sand-200 bg-sand-50 py-7">
        <div className="container-page">
          <div className="h-12 w-full max-w-xl animate-pulse rounded-full bg-white/70" />
        </div>
      </section>
      <section className="py-14 sm:py-16">
        <div className="container-page">
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-sand-100"
              />
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}