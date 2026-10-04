"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sanitizeRichText, sanitizeText } from "@/lib/sanitize";
import {
  fromDateTimeInput,
  readingMinutes,
  slugify,
  uniqueSlug,
} from "@/lib/utils";
import { fieldErrors } from "@/lib/validation";
import { POST_STATUSES } from "@/lib/enums";

// ── Shared result shape ───────────────────────────────────────

export interface PostActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Set on create/update so the client can navigate to the saved row. */
  id?: string;
  slug?: string;
}

const DENIED: PostActionResult = { ok: false, message: "غير مصرّح." };
const FORBIDDEN: PostActionResult = {
  ok: false,
  message: "لا تملك صلاحية تعديل المقالات.",
};

/** Best-effort client IP for the audit trail. */
async function requestIp(): Promise<string | null> {
  const hdrs = await headers();
  return clientIpFrom(hdrs);
}

// ── Validation ────────────────────────────────────────────────

const optionalText = (max: number) =>
  z.string().trim().max(max, "النص طويل جدًا.").optional().or(z.literal(""));

const postSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "العنوان مطلوب (٣ أحرف على الأقل).")
    .max(200, "العنوان طويل جدًا."),
  slug: optionalText(220),
  excerpt: z
    .string()
    .trim()
    .min(10, "المقتطف مطلوب (١٠ أحرف على الأقل).")
    .max(400, "المقتطف طويل جدًا."),
  content: z.string().min(1, "اكتب محتوى المقال أولًا."),
  coverImage: optionalText(500),
  coverImageAlt: optionalText(200),
  categoryId: optionalText(40),
  authorId: optionalText(40),
  status: z.enum(POST_STATUSES),
  publishedAt: optionalText(40),
  scheduledAt: optionalText(40),
  featuredOnHome: z.boolean().optional(),
  noIndex: z.boolean().optional(),
  seoTitle: optionalText(200),
  seoDescription: optionalText(320),
  tags: z.array(z.string().trim().min(1).max(60)).max(20, "الوسوم كثيرة جدًا.").optional(),
});

export type PostInput = z.input<typeof postSchema>;

const categorySchema = z.object({
  name: z.string().trim().min(2, "اسم التصنيف مطلوب.").max(80, "الاسم طويل جدًا."),
  slug: optionalText(120),
  description: optionalText(300),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export type CategoryInput = z.input<typeof categorySchema>;

// ── Cache invalidation ────────────────────────────────────────

/**
 * Anything that can show a post has to be refreshed: the dashboard list, the
 * public blog index, the article page (route pattern + the exact slug we know)
 * and the home page carousel.
 */
function revalidateBlog(slug?: string | null) {
  revalidatePath("/admin/posts");
  revalidatePath("/admin/posts/[id]", "page");
  revalidatePath("/admin/categories");
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  revalidatePath("/");
  if (slug) revalidatePath(`/blog/${slug}`);
}

// ── Helpers ───────────────────────────────────────────────────

/** Upserts tag rows by slug and returns their ids. */
async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of names) {
    const name = sanitizeText(raw, 60);
    if (!name) continue;
    const slug = slugify(name, "tag");
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
      select: { id: true },
    });
    if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  return ids;
}

/**
 * Status → date columns.
 *
 * PUBLISHED stamps `publishedAt` (keeping the original when re-saving) and
 * always clears `scheduledAt`. SCHEDULED requires a *future* `scheduledAt` and
 * leaves `publishedAt` alone. DRAFT clears both.
 */
function resolveDates(
  status: (typeof POST_STATUSES)[number],
  requestedPublishedAt: string | null,
  requestedScheduledAt: string | null,
  existingPublishedAt: Date | null,
): { status: string; publishedAt: Date | null; scheduledAt: Date | null } | { error: string } {
  const now = new Date();

  if (status === "PUBLISHED") {
    const parsed = requestedPublishedAt ? fromDateTimeInput(requestedPublishedAt) : null;
    return {
      status: "PUBLISHED",
      publishedAt: parsed ?? existingPublishedAt ?? now,
      scheduledAt: null,
    };
  }

  if (status === "SCHEDULED") {
    const when = requestedScheduledAt ? fromDateTimeInput(requestedScheduledAt) : null;
    if (!when) return { error: "حدّد تاريخًا وساعة لنشر المقال لاحقًا." };
    if (Number.isNaN(when.getTime())) return { error: "تاريخ الجدولة غير صالح." };
    if (when.getTime() <= now.getTime()) {
      return { error: "تاريخ الجدولة يجب أن يكون في المستقبل." };
    }
    return { status: "SCHEDULED", publishedAt: existingPublishedAt, scheduledAt: when };
  }

  return { status: "DRAFT", publishedAt: null, scheduledAt: null };
}

async function nextPostSlug(desired: string, excludeId?: string | null): Promise<string> {
  const fallback = desired ? "post" : "مقال-بدون-عنوان";
  return uniqueSlug(
    desired || "مقال-بدون-عنوان",
    async (candidate) => {
      const row = await prisma.post.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return Boolean(row && row.id !== excludeId);
    },
    fallback,
  );
}

/** Title + excerpt → the lower-cased column the dashboard searches against. */
function buildSearchText(title: string, excerpt: string): string {
  return `${title} ${excerpt}`.toLowerCase();
}

// ── Slug helpers used by the form ─────────────────────────────

/** Suggests an Arabic-friendly slug for a title. */
export async function suggestSlug(title: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const clean = sanitizeText(title, 200);
  if (!clean) return { ok: false, message: "اكتب العنوان أولًا." };
  return { ok: true, slug: slugify(clean, "post") };
}

/** Checks a candidate slug against the database (excluding the current post). */
export async function checkSlugAvailable(
  candidate: string,
  excludeId?: string | null,
): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const desired = slugify(sanitizeText(candidate, 220), "post");
  const final = await nextPostSlug(desired, excludeId ?? null);
  return {
    ok: true,
    slug: final,
    message: final === desired ? "الرابط متاح." : `الرابط مأخوذ — سيصبح: ${final}`,
  };
}

// ── Create / update ───────────────────────────────────────────

export async function createPost(input: PostInput): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "راجع الحقول المطلوبة.", errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const title = sanitizeText(data.title, 200);
  const excerpt = sanitizeText(data.excerpt, 400);
  // Defence in depth: the body is later rendered with dangerouslySetInnerHTML.
  const content = sanitizeRichText(data.content);

  const slug = await nextPostSlug(data.slug || title, null);

  const dates = resolveDates(data.status, data.publishedAt ?? null, data.scheduledAt ?? null, null);
  if ("error" in dates) return { ok: false, message: dates.error, errors: { scheduledAt: dates.error } };

  const tagIds = await resolveTagIds(data.tags ?? []);

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      searchText: buildSearchText(title, excerpt),
      excerpt,
      content,
      coverImage: sanitizeText(data.coverImage ?? "", 500) || null,
      coverImageAlt: sanitizeText(data.coverImageAlt ?? "", 200) || null,
      categoryId: data.categoryId || null,
      authorId: data.authorId || user.id,
      status: dates.status,
      publishedAt: dates.publishedAt,
      scheduledAt: dates.scheduledAt,
      readingMinutes: readingMinutes(content),
      noIndex: data.noIndex ?? false,
      featuredOnHome: data.featuredOnHome ?? false,
      seoTitle: sanitizeText(data.seoTitle ?? "", 200) || null,
      seoDescription: sanitizeText(data.seoDescription ?? "", 320) || null,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
    },
    select: { id: true, slug: true },
  });

  const activityAction =
    dates.status === "PUBLISHED" ? "PUBLISH" : dates.status === "SCHEDULED" ? "SCHEDULE" : "CREATE";

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: activityAction,
    entity: "Post",
    entityId: post.id,
    summary:
      dates.status === "PUBLISHED"
        ? `نشر مقالًا: ${title}`
        : dates.status === "SCHEDULED"
          ? `جدولة مقال للنشر: ${title}`
          : `إنشاء مقال كمسودة: ${title}`,
    ip: await requestIp(),
  });

  revalidateBlog(post.slug);
  return { ok: true, id: post.id, slug: post.slug, message: "تم حفظ المقال." };
}

export async function updatePost(id: string, input: PostInput): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const existing = await prisma.post.findUnique({
    where: { id },
    select: { id: true, slug: true, publishedAt: true, status: true },
  });
  if (!existing) return { ok: false, message: "المقال غير موجود." };

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "راجع الحقول المطلوبة.", errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const title = sanitizeText(data.title, 200);
  const excerpt = sanitizeText(data.excerpt, 400);
  const content = sanitizeRichText(data.content);

  const slug = await nextPostSlug(data.slug || title, id);

  const dates = resolveDates(
    data.status,
    data.publishedAt ?? null,
    data.scheduledAt ?? null,
    existing.publishedAt,
  );
  if ("error" in dates) return { ok: false, message: dates.error, errors: { scheduledAt: dates.error } };

  const tagIds = await resolveTagIds(data.tags ?? []);

  const post = await prisma.post.update({
    where: { id },
    data: {
      title,
      slug,
      searchText: buildSearchText(title, excerpt),
      excerpt,
      content,
      coverImage: sanitizeText(data.coverImage ?? "", 500) || null,
      coverImageAlt: sanitizeText(data.coverImageAlt ?? "", 200) || null,
      categoryId: data.categoryId || null,
      authorId: data.authorId || user.id,
      status: dates.status,
      publishedAt: dates.publishedAt,
      scheduledAt: dates.scheduledAt,
      readingMinutes: readingMinutes(content),
      noIndex: data.noIndex ?? false,
      featuredOnHome: data.featuredOnHome ?? false,
      seoTitle: sanitizeText(data.seoTitle ?? "", 200) || null,
      seoDescription: sanitizeText(data.seoDescription ?? "", 320) || null,
      // Replace the tag set wholesale — the row is a join table.
      tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
    },
    select: { id: true, slug: true },
  });

  const activityAction =
    dates.status === "PUBLISHED" && existing.status !== "PUBLISHED"
      ? "PUBLISH"
      : dates.status === "SCHEDULED" && existing.status !== "SCHEDULED"
        ? "SCHEDULE"
        : existing.status === "PUBLISHED" && dates.status !== "PUBLISHED"
          ? "UNPUBLISH"
          : "UPDATE";

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: activityAction,
    entity: "Post",
    entityId: post.id,
    summary: `تعديل مقال: ${title}`,
    ip: await requestIp(),
  });

  revalidateBlog(post.slug);
  // The old slug may have changed, so refresh the previous URL too.
  if (existing.slug !== post.slug) revalidateBlog(existing.slug);
  return { ok: true, id: post.id, slug: post.slug, message: "تم تحديث المقال." };
}

// ── Delete / duplicate ────────────────────────────────────────

export async function deletePost(id: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const existing = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, _count: { select: { tags: true } } },
  });
  if (!existing) return { ok: false, message: "المقال غير موجود." };

  // `PostTag.post` declares onDelete: Cascade, so the join rows go with the
  // post — we still clear them explicitly so the behaviour is identical on
  // SQLite and PostgreSQL regardless of FK enforcement.
  await prisma.$transaction([
    prisma.postTag.deleteMany({ where: { postId: id } }),
    prisma.post.delete({ where: { id } }),
  ]);

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "Post",
    entityId: id,
    summary: `حذف مقال: ${existing.title}`,
    ip: await requestIp(),
  });

  revalidateBlog(existing.slug);
  return { ok: true, id, message: "تم حذف المقال." };
}

export async function duplicatePost(id: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const source = await prisma.post.findUnique({
    where: { id },
    include: { tags: { select: { tagId: true } } },
  });
  if (!source) return { ok: false, message: "المقال غير موجود." };

  const title = sanitizeText(`${source.title} — نسخة`, 200);
  const slug = await nextPostSlug(`${source.slug}-نسخة`, null);

  // Sanitise again on the way in: the stored copy may predate the allow-list.
  const content = sanitizeRichText(source.content);

  const copy = await prisma.post.create({
    data: {
      title,
      slug,
      searchText: buildSearchText(title, source.excerpt),
      excerpt: source.excerpt,
      content,
      coverImage: source.coverImage,
      coverImageAlt: source.coverImageAlt,
      categoryId: source.categoryId,
      authorId: user.id,
      status: "DRAFT",
      publishedAt: null,
      scheduledAt: null,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      noIndex: source.noIndex,
      featuredOnHome: false,
      readingMinutes: readingMinutes(content),
      tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
    },
    select: { id: true, slug: true },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "Post",
    entityId: copy.id,
    summary: `نسخ مقال: ${source.title}`,
    ip: await requestIp(),
  });

  revalidateBlog(copy.slug);
  return { ok: true, id: copy.id, slug: copy.slug, message: "تم إنشاء نسخة كمسودة." };
}

// ── Publish / schedule toggles ────────────────────────────────

export async function togglePublish(id: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, status: true, publishedAt: true },
  });
  if (!post) return { ok: false, message: "المقال غير موجود." };

  const publishing = post.status !== "PUBLISHED";
  const now = new Date();

  await prisma.post.update({
    where: { id },
    data: publishing
      ? { status: "PUBLISHED", publishedAt: post.publishedAt ?? now, scheduledAt: null }
      : { status: "DRAFT", publishedAt: null, scheduledAt: null },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: publishing ? "PUBLISH" : "UNPUBLISH",
    entity: "Post",
    entityId: id,
    summary: publishing ? `نشر مقال: ${post.title}` : `إلغاء نشر مقال: ${post.title}`,
    ip: await requestIp(),
  });

  revalidateBlog(post.slug);
  return {
    ok: true,
    id,
    message: publishing ? "تم نشر المقال." : "أُعيد المقال إلى المسودات.",
  };
}

export async function schedulePost(id: string, scheduledAt: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true },
  });
  if (!post) return { ok: false, message: "المقال غير موجود." };

  const when = scheduledAt ? fromDateTimeInput(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) {
    return { ok: false, message: "حدّد تاريخًا وساعة صحيحين.", errors: { scheduledAt: "تاريخ غير صالح." } };
  }
  if (when.getTime() <= Date.now()) {
    return {
      ok: false,
      message: "تاريخ الجدولة يجب أن يكون في المستقبل.",
      errors: { scheduledAt: "اختر تاريخًا مستقبليًا." },
    };
  }

  await prisma.post.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt: when },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "SCHEDULE",
    entity: "Post",
    entityId: id,
    summary: `جدولة مقال للنشر: ${post.title}`,
    ip: await requestIp(),
  });

  revalidateBlog(post.slug);
  return { ok: true, id, message: "تمت جدولة المقال." };
}

// ── Categories ────────────────────────────────────────────────

export async function createCategory(input: CategoryInput): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "راجع بيانات التصنيف.", errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const name = sanitizeText(data.name, 80);
  const slug = await uniqueSlug(
    data.slug || name,
    async (candidate) => Boolean(await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
    "تصنيف",
  );

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description: sanitizeText(data.description ?? "", 300) || null,
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
    },
    select: { id: true, slug: true },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "Category",
    entityId: category.id,
    summary: `إنشاء تصنيف: ${name}`,
    ip: await requestIp(),
  });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/categories");
  return { ok: true, id: category.id, slug: category.slug, message: "تمت إضافة التصنيف." };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, message: "التصنيف غير موجود." };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "راجع بيانات التصنيف.", errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const name = sanitizeText(data.name, 80);
  const slug = await uniqueSlug(
    data.slug || name,
    async (candidate) => {
      const row = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(row && row.id !== id);
    },
    "تصنيف",
  );

  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug,
      description: sanitizeText(data.description ?? "", 300) || null,
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "Category",
    entityId: id,
    summary: `تعديل تصنيف: ${name}`,
    ip: await requestIp(),
  });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/categories");
  revalidatePath("/blog");
  revalidatePath("/");
  return { ok: true, id, slug, message: "تم تحديث التصنيف." };
}

export async function deleteCategory(id: string): Promise<PostActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "posts.edit")) return FORBIDDEN;

  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { posts: true } } },
  });
  if (!existing) return { ok: false, message: "التصنيف غير موجود." };

  // `Post.category` is onDelete: SetNull, so articles survive without a category.
  await prisma.category.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "Category",
    entityId: id,
    summary: `حذف تصنيف: ${existing.name}`,
    ip: await requestIp(),
  });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/categories");
  revalidatePath("/blog");
  revalidatePath("/");
  return {
    ok: true,
    id,
    message:
      existing._count.posts > 0
        ? `تم حذف التصنيف. ${existing._count.posts} مقالًا بلا تصنيف الآن.`
        : "تم حذف التصنيف.",
  };
}