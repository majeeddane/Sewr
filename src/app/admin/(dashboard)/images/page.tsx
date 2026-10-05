import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { ImagesManager } from "@/components/admin/images/images-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الصور",
  description: "كل صور الموقع في مكان واحد: غيّرها أو أخفِها أو أزلها.",
};

const CONTENT_LABEL: Record<string, string> = {
  SERVICE: "خدمة",
  PROGRAM: "برنامج",
  PROTOCOL: "بروتوكول",
};

export default async function ImagesPage() {
  const context = await getAuthContext();
  const user = context.user;
  if (!user) redirect("/admin/login");

  const settings = await prisma.siteSetting.findUnique({ where: { id: "singleton" } });
  if (!settings) redirect("/admin");

  const [content, posts] = await Promise.all([
    prisma.contentItem.findMany({
      select: { id: true, type: true, title: true, slug: true, image: true, imageHidden: true },
      orderBy: [{ type: "asc" }, { order: "asc" }],
    }),
    prisma.post.findMany({
      select: { id: true, title: true, slug: true, coverImage: true, coverHidden: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="الصور"
        description="كل صور الموقع في مكان واحد. غيّر أي صورة، أو أخفِها، أو أزلها — بدون الحاجة لبحث في الإعدادات."
        breadcrumb={[{ href: "/admin", label: "لوحة التحكم" }]}
      />

      <ImagesManager
        canEditSettings={can(user.role, "settings.edit")}
        canEditContent={can(user.role, "content.edit")}
        globals={[
          {
            label: "شعار الموقع",
            hint: "يظهر في رأس كل صفحة والفوتر.",
            column: "logoPath",
            path: settings.logoPath,
            alt: settings.logoAlt,
            hidden: false,
            hideable: false,
            aspect: "aspect-[5/1]",
            folder: "brand",
          },
          {
            label: "أيقونة المتصفح",
            hint: "الصورة الصغيرة في تبويب المتصفح.",
            column: "faviconPath",
            path: settings.faviconPath,
            alt: null,
            hidden: false,
            hideable: false,
            aspect: "aspect-square",
            folder: "brand",
          },
          {
            label: "صورة الواجهة",
            hint: "خلفية الصفحة الرئيسية الممتدة من الحافة للحافة.",
            column: "heroImage",
            path: settings.heroImage,
            alt: settings.heroImageAlt,
            hidden: settings.heroImageHidden,
            hideable: true,
            aspect: "aspect-[16/9]",
            folder: "hero",
          },
          {
            label: "قسم «من نحن»",
            hint: "الصورة بجانب نبذة المركز في الصفحة الرئيسية.",
            column: "homeAboutImage",
            path: settings.homeAboutImage,
            alt: settings.homeAboutImageAlt,
            hidden: settings.homeAboutImageHidden,
            hideable: true,
            aspect: "aspect-[4/3]",
            folder: "home",
          },
          {
            label: "منهجية التعافي",
            hint: "الرسم التوضيحي في قسم الخطوات.",
            column: "aboutVision2030Image",
            path: settings.aboutVision2030Image,
            alt: settings.aboutVision2030ImageAlt,
            hidden: settings.aboutVision2030ImageHidden,
            hideable: true,
            aspect: "aspect-square",
            folder: "home",
          },
          {
            label: "صورة المشاركة",
            hint: "الصورة التي تظهر عند مشاركة رابط الموقع في واتساب.",
            column: "ogImage",
            path: settings.ogImage,
            alt: null,
            hidden: false,
            hideable: false,
            aspect: "aspect-[1.91/1]",
            folder: "general",
          },
        ]}
        contentItems={content.map((item) => ({
          id: item.id,
          kind: "content" as const,
          title: item.title,
          badge: CONTENT_LABEL[item.type] ?? item.type,
          href: `/admin/content/${item.type}/${item.id}`,
          image: item.image,
          hidden: item.imageHidden,
        }))}
        posts={posts.map((post) => ({
          id: post.id,
          kind: "post" as const,
          title: post.title,
          badge: "مقال",
          href: `/admin/posts/${post.id}`,
          image: post.coverImage,
          hidden: post.coverHidden,
        }))}
      />
    </>
  );
}