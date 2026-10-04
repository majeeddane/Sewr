import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import { getSiteSettings } from "@/lib/settings";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

/**
 * Root layout: fonts, metadata and the toast host — nothing else.
 *
 * The public chrome (header / footer / WhatsApp button) lives in the `(site)`
 * route group so the dashboard is never wrapped in marketing furniture, and the
 * two shells can evolve independently.
 */
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const arabicDisplay = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-arabic",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings.seoTitle || `${settings.siteName} — ${settings.tagline}`,
      template: `%s | ${settings.siteName}`,
    },
    description:
      settings.seoDescription ||
      "مركز سوار وعي للإحاطة بعلوم التعافي — رعاية نفسية وعلمية متخصصة في تعافي الإدمان، وبرامج إعادة تأهيل، وإرشاد أسري، وتوعية بأحدث الأطر العلمية.",
    keywords: settings.seoKeywords
      ? settings.seoKeywords.split(",").map((k) => k.trim())
      : [
          "سوار وعي",
          "Sewr Waie",
          "علاج الإدمان",
          "إعادة التأهيل",
          "الصحة النفسية",
          "الإرشاد الأسري",
          "التوعية بالإدمان",
          "الرياض",
          "السعودية",
        ],
    authors: [{ name: settings.siteName }],
    creator: settings.siteName,
    publisher: settings.siteName,
    applicationName: settings.siteName,
    category: "health",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "ar_SA",
      url: siteUrl,
      siteName: settings.siteName,
      title: settings.seoTitle || `${settings.siteName} — ${settings.tagline}`,
      description: settings.seoDescription || settings.tagline,
      images: settings.ogImage
        ? [{ url: settings.ogImage, width: 1200, height: 630, alt: settings.siteName }]
        : [{ url: "/opengraph-image", width: 1200, height: 630, alt: settings.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoTitle || settings.siteName,
      description: settings.seoDescription || settings.tagline,
      images: settings.ogImage ? [settings.ogImage] : ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: settings.faviconPath || "/icon.svg",
      apple: settings.faviconPath || "/icon.svg",
    },
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: true, email: true, address: false },
    other: {
      "geo.region": "SA-01",
      "geo.placename": settings.city || "السعودية",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4B2A7B" },
    { media: "(prefers-color-scheme: dark)", color: "#2A1447" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${arabic.variable} ${arabicDisplay.variable}`}
    >
      <head>
        {/*
          Two blocking bootstrap scripts, both run before first paint:
            1. `js`  — lets the scroll-reveal animation hide off-screen sections
               only when scripting is available.
            2. theme — applies the dashboard's saved colour scheme so the admin
               never flashes the wrong background. Scoped to /admin so the
               public site is never affected.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js')`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname.indexOf('/admin')!==0)return;var s=localStorage.getItem('sw-admin-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-sand-50 antialiased">
        {children}
        {/* Toast host lives here so both the public site and the dashboard
            can raise notifications from anywhere in the tree. */}
        <Toaster />
      </body>
    </html>
  );
}
