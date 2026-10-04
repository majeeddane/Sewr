import type { Metadata } from "next";
import {
  CONTENT_COPY,
  ContentDetail,
  buildStaticParamsFor,
} from "@/components/site/content-pages";
import { getContentItemBySlug, getContentItems } from "@/lib/queries";
import type { ContentType } from "@/lib/enums";
import { truncate } from "@/lib/utils";

const TYPE: ContentType = "PROTOCOL";
const COPY = CONTENT_COPY[TYPE];

export const revalidate = 300;

export async function generateStaticParams() {
  return buildStaticParamsFor(TYPE);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getContentItemBySlug(TYPE, slug);
  if (!item) return { title: COPY.eyebrow };

  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || truncate(item.shortDescription, 158),
    alternates: { canonical: `${COPY.basePath}/${item.slug}` },
  };
}

export default async function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const all = await getContentItems(TYPE);
  const index = all.findIndex((item) => item.slug === slug);
  const related = [
    ...all.slice(Math.max(0, index - 1), Math.max(0, index)),
    ...all.slice(index + 1),
  ].slice(0, 3);

  return <ContentDetail type={TYPE} slug={slug} related={related} />;
}
