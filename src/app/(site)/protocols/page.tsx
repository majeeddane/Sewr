import type { Metadata } from "next";
import { ContentListing, CONTENT_COPY } from "@/components/site/content-pages";
import { getContentItems } from "@/lib/queries";

export const revalidate = 300;

const COPY = CONTENT_COPY.PROTOCOL;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: COPY.eyebrow,
    description: COPY.listDescription,
    alternates: { canonical: "/protocols" },
  };
}

export default async function ProtocolsPage() {
  const items = await getContentItems("PROTOCOL");
  return (
    <ContentListing
      type="PROTOCOL"
      eyebrow={COPY.eyebrow}
      title={COPY.listTitle}
      description={COPY.listDescription}
      items={items}
    />
  );
}
