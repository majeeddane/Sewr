import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseJson, truncate, readingMinutes } from "./utils";
import { safeQuery } from "./db-fallback";
import type { ContentType } from "./enums";

/**
 * Read-only queries used by the public site. Every function is wrapped in
 * React's `cache()` so a page that shows the same list twice only queries once
 * per render.
 */

export interface Step {
  title: string;
  description: string;
}

export interface PublicContentItem {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  icon: string | null;
  image: string | null;
  imageAlt: string | null;
  audience: string | null;
  steps: Step[];
  benefits: string[];
  outcomes: string[];
  notes: string[];
  durationLabel: string | null;
  faqs: Array<{ question: string; answer: string }>;
  seoTitle: string | null;
  seoDescription: string | null;
  order: number;
  isFeatured: boolean;
}

// ── Content items ─────────────────────────────────────────────

export const getContentItems = cache(
  async (type: ContentType, opts: { featuredOnly?: boolean; limit?: number } = {}) =>
    safeQuery<PublicContentItem[]>("contentItems", async () => {
      const items = await prisma.contentItem.findMany({
        where: {
          type,
          isActive: true,
          ...(opts.featuredOnly ? { isFeatured: true } : {}),
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        ...(opts.limit ? { take: opts.limit } : {}),
      });
      return items.map(toPublicItem);
    }, []),
);

export const getContentItemBySlug = cache(
  async (type: ContentType, slug: string): Promise<PublicContentItem | null> =>
    safeQuery<PublicContentItem | null>("contentItemBySlug", async () => {
      const item = await prisma.contentItem.findFirst({
        where: { type, slug, isActive: true },
      });
      return item ? toPublicItem(item) : null;
    }, null),
);

export const getAllContentSlugs = cache((type: ContentType) =>
  safeQuery<Array<{ slug: string }>>(
    "contentSlugs",
    () =>
      prisma.contentItem.findMany({
        where: { type, isActive: true },
        select: { slug: true },
      }),
    [],
  ),
);

type RawItem = Awaited<ReturnType<typeof prisma.contentItem.findFirstOrThrow>>;

export function toPublicItem(item: RawItem): PublicContentItem {
  return {
    id: item.id,
    type: item.type as ContentType,
    slug: item.slug,
    title: item.title,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription,
    icon: item.icon,
    image: item.image,
    imageAlt: item.imageAlt,
    audience: item.audience,
    steps: parseJson<Step[]>(item.stepsJson, []),
    benefits: parseJson<string[]>(item.benefitsJson, []),
    outcomes: parseJson<string[]>(item.outcomesJson, []),
    notes: parseJson<string[]>(item.notesJson, []),
    durationLabel: item.durationLabel,
    faqs: parseJson<Array<{ question: string; answer: string }>>(item.faqsJson, []),
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    order: item.order,
    isFeatured: item.isFeatured,
  };
}

// ── Home page blocks ──────────────────────────────────────────

export const getTrustItems = cache(() =>
  safeQuery("trustItems", () =>
    prisma.trustItem.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getProcessSteps = cache(() =>
  safeQuery("processSteps", () =>
    prisma.processStep.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getValueItems = cache(() =>
  safeQuery("valueItems", () =>
    prisma.valueItem.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getWhyItems = cache(() =>
  safeQuery("whyItems", () =>
    prisma.whyItem.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getStatistics = cache(() =>
  safeQuery("statistics", () =>
    prisma.statistic.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getTestimonials = cache(() =>
  safeQuery("testimonials", () =>
    prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  []),
);

export const getFaqs = cache((category?: string) =>
  safeQuery("faqs", () =>
    prisma.faq.findMany({
      where: { isActive: true, ...(category ? { category } : {}) },
      orderBy: { order: "asc" },
    }),
  []),
);

// ── Blog ──────────────────────────────────────────────────────

const POST_INCLUDE = {
  category: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: true } },
} as const;

type RawPost = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

export interface PublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  publishedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  views: number;
  readingMinutes: number;
  featuredOnHome: boolean;
}

export function toPublicPost(post: RawPost): PublicPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    coverImageAlt: post.coverImageAlt,
    category: post.category
      ? {
          id: post.category.id,
          name: post.category.name,
          slug: post.category.slug,
        }
      : null,
    tags: post.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      slug: t.tag.slug,
    })),
    author: post.author
      ? { id: post.author.id, name: post.author.name, avatarUrl: post.author.avatarUrl }
      : null,
    publishedAt: post.publishedAt,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    views: post.views,
    readingMinutes: post.readingMinutes || readingMinutes(post.content),
    featuredOnHome: post.featuredOnHome,
  };
}

export const getPublishedPosts = cache(
  async (opts: { limit?: number; categorySlug?: string; tagSlug?: string; excludeId?: string } = {}) =>
    safeQuery<PublicPost[]>("publishedPosts", async () => {
      const posts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          noIndex: false,
          ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
          ...(opts.tagSlug ? { tags: { some: { tag: { slug: opts.tagSlug } } } } : {}),
          ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
        },
        include: POST_INCLUDE,
        orderBy: { publishedAt: "desc" },
        ...(opts.limit ? { take: opts.limit } : {}),
      });
      return posts.map(toPublicPost);
    }, []),
);

export const getPostBySlug = cache((slug: string) =>
  safeQuery<PublicPost | null>("postBySlug", async () => {
    const post = await prisma.post.findFirst({
      where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
      include: POST_INCLUDE,
    });
    return post ? toPublicPost(post) : null;
  }, null),
);

/** Same category first, then anything else recent. */
export const getRelatedPosts = cache(
  (postId: string, categoryId: string | null) =>
    safeQuery<PublicPost[]>("relatedPosts", async () => {
      const candidates = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          id: { not: postId },
        },
        include: POST_INCLUDE,
        orderBy: { publishedAt: "desc" },
        take: 12,
      });

      // Same-category posts float to the top, the rest keep date order.
      const posts = [
        ...candidates.filter((p) => p.categoryId && p.categoryId === categoryId),
        ...candidates.filter((p) => !p.categoryId || p.categoryId !== categoryId),
      ].slice(0, 3);

      return posts.map(toPublicPost);
    }, []),
);

export const getPostSlugs = cache(() =>
  safeQuery<Array<{ slug: string; updatedAt: Date }>>(
    "postSlugs",
    () =>
      prisma.post.findMany({
        where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
        select: { slug: true, updatedAt: true },
      }),
    [],
  ),
);

export const getCategories = cache(() =>
  safeQuery("categories", () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { posts: true } } },
    }),
  []),
);

export const getPopularTags = cache((take = 20) =>
  safeQuery("popularTags", () =>
    prisma.tag.findMany({
      orderBy: { posts: { _count: "desc" } },
      take,
    }),
  []),
);

// ── Static pages ──────────────────────────────────────────────

export const getPageBySlug = cache((slug: string) =>
  safeQuery("pageBySlug", () =>
    prisma.page.findFirst({ where: { slug, isPublished: true } }),
  null),
);

export const getAllPageSlugs = cache(() =>
  safeQuery<Array<{ slug: string; updatedAt: Date }>>(
    "pageSlugs",
    () =>
      prisma.page.findMany({
        where: { isPublished: true, noIndex: false },
        select: { slug: true, updatedAt: true },
      }),
    [],
  ),
);

// ── Counts used by the public footer / dashboard ──────────────

export const getContentCounts = cache(() =>
  safeQuery("contentCounts", async () => {
    const [services, programs, protocols, posts] = await Promise.all([
      prisma.contentItem.count({ where: { type: "SERVICE", isActive: true } }),
      prisma.contentItem.count({ where: { type: "PROGRAM", isActive: true } }),
      prisma.contentItem.count({ where: { type: "PROTOCOL", isActive: true } }),
      prisma.post.count({
        where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      }),
    ]);
    return { services, programs, protocols, posts };
  }, { services: 0, programs: 0, protocols: 0, posts: 0 }),
);

/** Meta description helper — falls back to the page excerpt, then the text. */
export function metaDescription(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = truncate(candidate, 158);
    if (text.length > 20) return text;
  }
  return "مركز سوار وعي للإحاطة بعلوم التعافي — رعاية نفسية وعلمية متخصصة في تعافي الإدمان ودعم الأسرة.";
}
