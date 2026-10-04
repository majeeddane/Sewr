import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero, Prose } from "@/components/site/common";
import { getAllPageSlugs, getPageBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  const pages = await getAllPageSlugs();
  return pages.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "الصفحة غير موجودة" };

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical: `/${page.slug}` },
    robots: page.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <>
      <PageHero
        eyebrow="معلومات قانونية"
        title={page.title}
        description={page.subtitle}
        crumbs={[{ label: page.title }]}
        compact
      />

      <article className="py-14 sm:py-20">
        <div className="container-narrow">
          <Prose html={page.content} />

          <p className="mt-12 border-t border-sand-200 pt-6 text-xs text-ink-400">
            آخر تحديث: {formatDate(page.updatedAt)}
          </p>
        </div>
      </article>
    </>
  );
}
