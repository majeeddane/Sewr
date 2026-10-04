import { cache } from "react";
import type { SiteSetting } from "@prisma/client";
import { prisma } from "./prisma";
import { parseJson } from "./utils";
import { safeQuery } from "./db-fallback";

/**
 * A complete, usable settings object with every column empty.
 *
 * Returning this instead of throwing lets the marketing chrome (header, footer,
 * WhatsApp button, SEO defaults) render even when the database is unreachable,
 * so a build never fails on a missing `DATABASE_URL`.
 */
function emptySettings(): SiteSetting {
  const now = new Date();
  return {
    id: "singleton",
    siteName: "سوار وعي",
    siteNameEn: "Sewr Waie",
    tagline: "مركز الإحاطة بعلوم التعافي",
    logoPath: null,
    logoAlt: null,
    faviconPath: null,
    blockAdminIndex: true,

    phone: null,
    whatsapp: null,
    whatsappMessage: null,
    email: null,
    address: null,
    city: null,
    country: "المملكة العربية السعودية",
    mapEmbedUrl: null,
    mapLinkUrl: null,
    workingHoursJson: null,
    socialsJson: null,

    heroBadge: null,
    heroTitle: null,
    heroDescription: null,
    heroImage: null,
    heroImageAlt: null,
    homeAboutTitle: null,
    homeAboutText: null,
    homeAboutImage: null,
    homeAboutImageAlt: null,
    homeServicesTitle: null,
    homeServicesText: null,
    homeServicesCtaText: null,
    homeProgramsTitle: null,
    homeProgramsText: null,
    homeBlogTitle: null,
    homeBlogText: null,
    homeTestimonialsTitle: null,
    homeFaqTitle: null,
    homeFaqText: null,
    finalCtaBadge: null,
    finalCtaTitle: null,
    finalCtaText: null,

    aboutHeroTitle: null,
    aboutHeroText: null,
    aboutWhoTitle: null,
    aboutWhoText: null,
    aboutVisionTitle: null,
    aboutVisionText: null,
    aboutMissionTitle: null,
    aboutMissionText: null,
    aboutValuesTitle: null,
    aboutValuesText: null,
    aboutVision2030Title: null,
    aboutVision2030Text: null,
    aboutVision2030Image: null,
    aboutWhyTitle: null,
    aboutWhyText: null,

    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    ogImage: null,
    analyticsCode: null,

    notifyEmailEnabled: true,
    notificationEmail: null,
    notifyOnNewClient: true,
    notifyOnNewMessage: true,
    notifyOnNewBooking: true,

    primaryColor: "#4B2A7B",
    accentColor: "#D9A441",

    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The editable site settings row. Cached per request so a page that renders the
 * header, footer, hero and WhatsApp button only hits the database once.
 */
export const getSiteSettings = cache(async () =>
  safeQuery<SiteSetting>(
    "siteSettings",
    async () => {
      const existing = await prisma.siteSetting.findUnique({
        where: { id: "singleton" },
      });
      if (existing) return existing;

      // Self-heal: the seed has not run yet.
      return prisma.siteSetting.create({ data: { id: "singleton" } });
    },
    emptySettings(),
  ),
);

export type SiteSettings = Awaited<ReturnType<typeof getSiteSettings>>;

export interface WorkingHour {
  day: string;
  hours: string;
}

export interface SocialLinks {
  x?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  snapchat?: string;
}

export function workingHours(settings: SiteSettings): WorkingHour[] {
  return parseJson<WorkingHour[]>(settings.workingHoursJson, []);
}

export function socialLinks(settings: SiteSettings): SocialLinks {
  return parseJson<SocialLinks>(settings.socialsJson, {});
}

/** Public-safe subset that is safe to hand to a Client Component. */
export interface PublicSettings {
  siteName: string;
  siteNameEn: string;
  tagline: string;
  logoPath: string | null;
  logoAlt: string | null;
  phone: string | null;
  whatsapp: string | null;
  whatsappMessage: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string;
  mapEmbedUrl: string | null;
  mapLinkUrl: string | null;
  socials: SocialLinks;
  hours: WorkingHour[];
  primaryColor: string;
  accentColor: string;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSiteSettings();
  return {
    siteName: s.siteName,
    siteNameEn: s.siteNameEn,
    tagline: s.tagline,
    logoPath: s.logoPath,
    logoAlt: s.logoAlt ?? s.siteName,
    phone: s.phone,
    whatsapp: s.whatsapp,
    whatsappMessage: s.whatsappMessage,
    email: s.email,
    address: s.address,
    city: s.city,
    country: s.country,
    mapEmbedUrl: s.mapEmbedUrl,
    mapLinkUrl: s.mapLinkUrl,
    socials: socialLinks(s),
    hours: workingHours(s),
    primaryColor: s.primaryColor,
    accentColor: s.accentColor,
  };
}

export { cache };
