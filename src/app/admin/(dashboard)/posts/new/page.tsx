import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { ButtonLink } from "@/components/ui/primitives";
import { PostForm } from "@/app/admin/(dashboard)/posts/post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مقال جديد" };

export default async function NewPostPage() {
  const { user } = await getAuthContext();
  if (!user || !can(user.role, "posts.edit")) redirect("/admin/posts");

  const [categories, tags, authors] = await Promise.all([
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

  return (
    <>
      <AdminPageHeader
        title="مقال جديد"
        description="اكتب المحتوى، ثم احفظه كمسودة أو انشره أو جدوله لوقت لاحق."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/posts", label: "المدونة" },
          { href: "/admin/posts/new", label: "مقال جديد" },
        ]}
        action={
          <ButtonLink href="/admin/posts" variant="outline" size="sm">
            رجوع إلى القائمة
          </ButtonLink>
        }
      />

      <PostForm
        categories={categories}
        tags={tags}
        authors={authors.map((author) => ({
          id: author.id,
          name: author.name,
          role: author.role,
        }))}
      />

      <p className="mt-8 text-xs text-ink-400">
        للرجوع دون حفظ:{" "}
        <Link href="/admin/posts" className="font-bold text-brand-700 hover:underline">
          قائمة المقالات
        </Link>
      </p>
    </>
  );
}