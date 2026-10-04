import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  User,
  Quote,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/db-fallback";
import {
  getPostBySlug,
  getPostSlugs,
  getRelatedPosts,
  metaDescription,
} from "@/lib/queries";
import { Breadcrumbs, Prose } from "@/components/site/common";
import { BlogCard } from "@/components/site/sections";
import { SectionHeading, Badge } from "@/components/ui/primitives";
import { ShareButtons } from "./share-buttons";
import { formatDate, truncate } from "@/lib/utils";

export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await getPostSlugs();
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "المقالة غير موجودة" };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  return {
    title: post.seoTitle || post.title,
    description: metaDescription(post.seoDescription, post.excerpt),
    alternates: { canonical: `/blog/${post.slug}` },
    keywords: post.tags.map((t) => t.name),    authors: post.author ? [{ name: post.author.name }] : undefined,
    openGraph: {
      type: "article",
      locale: "ar_SA",
      url: `${siteUrl}/blog/${post.slug}`,
      title: post.seoTitle || post.title,
      description: metaDescription(post.seoDescription, post.excerpt),
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.author ? [post.author.name] : undefined,
      tags: post.tags.map((t) => t.name),
      images: post.coverImage
        ? [
            {
              url: post.coverImage,
              width: 1200,
              height: 630,
              alt: post.coverImageAlt || post.title,
            },
          ]
        : [{ url: "/opengraph-image", width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description: metaDescription(post.seoDescription, post.excerpt),
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const raw = await safeQuery(
    "postCategory",
    () =>
      prisma.post.findUnique({
        where: { id: post.id },
        select: { categoryId: true },
      }),
    null,
  );
  const related = await getRelatedPosts(post.id, raw?.categoryId ?? null);

  // Fire-and-forget view counter. Never blocks rendering and never throws.
  void prisma.post
    .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: truncate(post.excerpt, 200),
    image: post.coverImage ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.publishedAt?.toISOString(),
    inLanguage: "ar",
    author: {
      "@type": post.author ? "Person" : "Organization",
      name: post.author?.name ?? "فريق سوار وعي",
    },
    publisher: {
      "@type": "Organization",
      name: "مركز سوار وعي",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Cover ──────────────────────────────────── */}
      <header className="relative overflow-hidden bg-brand-950">
        <div className="relative mx-auto max-w-4xl px-5 pb-14 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
          <Breadcrumbs
            tone="dark"
            items={[{ label: "المدونة", href: "/blog" }, { label: post.title }]}
            className="mb-8"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            {post.category && <Badge tone="gold">{post.category.name}</Badge>}
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-brand-200">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-brand-200">
              <Clock className="size-3.5" aria-hidden />
              {post.readingMinutes} دقائق قراءة
            </span>
          </div>

          <h1 className="mt-5 text-3xl leading-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.25]">
            {post.title}
          </h1>

          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-[1.95] text-brand-100">
            {post.excerpt}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-gold-500/20 text-gold-300 ring-1 ring-inset ring-gold-400/30">
                <User className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold text-white">
                  {post.author?.name ?? "فريق سوار وعي"}
                </span>
                <span className="text-xs text-brand-300">مركز سوار وعي</span>
              </span>
            </div>

            <ShareButtons title={post.title} url={`/blog/${post.slug}`} />
          </div>
        </div>
      </header>

      {/* ── Image + body ───────────────────────────── */}
      <article className="py-12 sm:py-16">
        <div className="container-narrow">
          {post.coverImage && (
            <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-2xl shadow-card">
              <Image
                src={post.coverImage}
                alt={post.coverImageAlt || post.title}
                fill
                priority
                sizes="(min-width: 832px) 52rem, 100vw"
                className="object-cover"
              />
            </div>
          )}

          <Prose html={post.content} />

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-7">
              <span className="text-sm font-bold text-ink-600">الوسوم:</span>
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/blog?tag=${tag.slug}`}
                  className="rounded-full bg-sand-100 px-3.5 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:bg-brand-100 hover:text-brand-800"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <aside className="mt-10 rounded-2xl border border-gold-200 bg-gold-50/70 p-6">
            <h2 className="flex items-center gap-2.5 text-base font-extrabold text-brand-900">
              <Quote className="size-4.5 text-gold-600" aria-hidden />
              ملاحظة توعوية
            </h2>
            <p className="mt-2.5 text-[0.875rem] leading-[1.95] text-ink-700">
              محتوى هذه المقالة للتوعية العامة، ولا يُغني عن استشارة الطبيب
              المختص ولا عن التقييم الفردي. إذا كنت تحتاج مساعدة، تواصل مع مركز
              سوار وعي أو أقرب جهة مرضية مختصة.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-800 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-900"
            >
              تواصل مع المركز
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </aside>
        </div>
      </article>

      {/* ── Related ────────────────────────────────── */}
      {related.length > 0 && (
        <section className="surface-purple py-16 sm:py-20">
          <div className="container-page">
            <SectionHeading title="اقرأ أيضًا" className="mb-10" />
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {related.map((rel) => (
                <li key={rel.id}>
                  <BlogCard post={rel} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="sr-only">عدد مشاهدات هذه المقالة يُحدَّث تلقائيًا.</p>
    </>
  );
}
