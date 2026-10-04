import type { Metadata } from "next";
import { ContentListing, CONTENT_COPY } from "@/components/site/content-pages";
import { getContentItems } from "@/lib/queries";

export const revalidate = 300;

const COPY = CONTENT_COPY.PROGRAM;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: COPY.eyebrow,
    description: COPY.listDescription,
    alternates: { canonical: "/programs" },
  };
}

export default async function ProgramsPage() {
  const items = await getContentItems("PROGRAM");
  return (
    <ContentListing
      type="PROGRAM"
      eyebrow={COPY.eyebrow}
      title={COPY.listTitle}
      description={COPY.listDescription}
      items={items}
    />
  );
}
