/** Shared shape for seeded services, programs and protocols. */
export type Step = { title: string; description: string };
export type QA = { question: string; answer: string };

export interface ContentSeed {
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  icon: string;
  image?: string | null;
  audience?: string;
  steps?: Step[];
  benefits?: string[];
  outcomes?: string[];
  notes?: string[];
  durationLabel?: string;
  faqs?: QA[];
  isFeatured?: boolean;
  order: number;
  seoTitle?: string;
  seoDescription?: string;
}
