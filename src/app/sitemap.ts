import type { MetadataRoute } from "next";
import { getAllContentSlugs } from "@/lib/queries";
import { getAllPageSlugs, getPostSlugs } from "@/lib/queries";

export const revalidate = 3600;

/**
 * Sitemap generated from the database, so publishing a post or activating a
 * service is reflected without touching any code.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/programs`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/protocols`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.9 },
    { url: `${base}/book`, changeFrequency: "yearly", priority: 0.9 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [services, programs, protocols, posts, pages] = await Promise.all([
    getAllContentSlugs("SERVICE"),
    getAllContentSlugs("PROGRAM"),
    getAllContentSlugs("PROTOCOL"),
    getPostSlugs(),
    getAllPageSlugs(),
  ]);

  const detail = (
    items: Array<{ slug: string }>,
    prefix: string,
    frequency: "daily" | "weekly" | "monthly" | "yearly",
    priority: number,
  ): MetadataRoute.Sitemap =>
    items.map(({ slug }) => ({
      url: `${base}${prefix}/${slug}`,
      changeFrequency: frequency,
      priority,
    }));

  return [
    ...staticRoutes,
    ...detail(services, "/services", "monthly", 0.8),
    ...detail(programs, "/programs", "monthly", 0.8),
    ...detail(protocols, "/protocols", "monthly", 0.6),
    ...detail(posts, "/blog", "weekly", 0.7),
    ...detail(pages, "", "yearly", 0.3),
  ];
}
