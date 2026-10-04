import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سوار وعي — مركز الإحاطة بعلوم التعافي",
    short_name: "سوار وعي",
    description:
      "رعاية نفسية وعلمية متخصصة في تعافي الإدمان وبرامج إعادة التأهيل والإرشاد الأسري.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
    background_color: "#FDFBF7",
    theme_color: "#4B2A7B",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
