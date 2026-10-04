import type { Metadata } from "next";
import { ContentListing, CONTENT_COPY } from "@/components/site/content-pages";
import { getContentItems } from "@/lib/queries";

export const revalidate = 300;

const COPY = CONTENT_COPY.SERVICE;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: COPY.eyebrow,
    description: COPY.listDescription,
    alternates: { canonical: "/services" },
  };
}

export default async function ServicesPage() {
  const items = await getContentItems("SERVICE");
  return (
    <ContentListing
      type="SERVICE"
      eyebrow={COPY.eyebrow}
      title={COPY.listTitle}
      description={COPY.listDescription}
      items={items}
    />
  );
}
