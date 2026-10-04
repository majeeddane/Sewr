import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { PostForm } from "@/app/admin/(dashboard)/posts/post-form";
import { POST_STATUS_LABELS, isPostStatus } from "@/lib/enums";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تعديل مقال" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getAuthContext();
  if (!user || !can(user.role, "posts.edit")) redirect("/admin/posts");

  const { id } = await params;

  const [post, categories, tags, authors] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  if (!post) notFound();

  const status = isPostStatus(post.status) ? post.status : "DRAFT";

  return (
    <>
      <AdminPageHeader
        title={post.title}
        description={`آخر تعديل ${formatDateTime(post.updatedAt)} · ${formatNumber(post.views)} مشاهدة · ${formatNumber(post.readingMinutes)} دقيقة قراءة`}
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/posts", label: "المدونة" },
          { href: `/admin/posts/${post.id}`, label: "تعديل مقال" },
        ]}
        action={
          <>
            <ButtonLink href={`/blog/${post.slug}`} variant="outline" size="sm">
              عرض على الموقع
            </ButtonLink>
            <ButtonLink href="/admin/posts" variant="ghost" size="sm">
              رجوع إلى القائمة
            </ButtonLink>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={status === "PUBLISHED" ? "success" : status === "SCHEDULED" ? "warn" : "sand"}>
          {POST_STATUS_LABELS[status]}
        </Badge>
        {post.featuredOnHome && <Badge tone="gold">مميّز في الرئيسية</Badge>}
        {post.noIndex && <Badge tone="outline">ممنوع من الفهرسة</Badge>}
        {post.allowComments && <Badge tone="info">التعليقات مفعّلة</Badge>}
      </div>

      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImage: post.coverImage,
          coverImageAlt: post.coverImageAlt ?? "",
          categoryId: post.categoryId ?? "",
          authorId: post.authorId ?? "",
          status: post.status,
          publishedAt: post.publishedAt,
          scheduledAt: post.scheduledAt,
          featuredOnHome: post.featuredOnHome,
          noIndex: post.noIndex,
          seoTitle: post.seoTitle ?? "",
          seoDescription: post.seoDescription ?? "",
          tagIds: post.tags.map((entry) => entry.tag.id),
        }}
        categories={categories}
        tags={tags}
        authors={authors.map((author) => ({
          id: author.id,
          name: author.name,
          role: author.role,
        }))}
      />

      <p className="mt-8 text-xs text-ink-400">
        التصنيف الحالي: {post.category?.name ?? "بدون تصنيف"} · المؤلف:{" "}
        {post.author?.name ?? "غير محدد"} ·{" "}
        <Link href={`/admin/posts?category=${post.categoryId ?? ""}`} className="font-bold text-brand-700 hover:underline">
          عرض مقالات نفس التصنيف
        </Link>
      </p>
    </>
  );
}