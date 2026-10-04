import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";

import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getSiteSettings, socialLinks, workingHours } from "@/lib/settings";
import { AdminPageHeader } from "@/components/admin/shell";
import { SitePreviewStrip } from "@/components/admin/settings/site-preview";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إعدادات الموقع" };

/**
 * إعدادات الموقع.
 *
 * Reads the `SiteSetting` singleton and hands a plain, serialisable snapshot to
 * the tabbed client form. The Server Action re-reads the session and the
 * capability on every save, so nothing here is a trust boundary.
 */
export default async function AdminSettingsPage() {
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "settings.view")) redirect("/admin");

  const s = await getSiteSettings();

  return (
    <>
      <AdminPageHeader
        title="إعدادات الموقع"
        description="كل ما يراه الزائر في الموقع العام: الهوية، التواصل، النصوص، تحسين محركات البحث، الإشعارات والألوان."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/settings", label: "إعدادات الموقع" },
        ]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
            <SettingsIcon className="size-4" aria-hidden />
            آخر حفظ: {s.updatedAt.toLocaleString("ar-SA-u-nu-latn-ca-gregory")}
          </span>
        }
      />

      <div className="flex flex-col gap-6">
        <SitePreviewStrip
          siteName={s.siteName}
          siteNameEn={s.siteNameEn}
          tagline={s.tagline}
          logoPath={s.logoPath}
          phone={s.phone}
          primaryColor={s.primaryColor}
          accentColor={s.accentColor}
        />

        <SettingsForm
          canEdit={can(user.role, "settings.edit")}
          settings={{
            siteName: s.siteName,
            siteNameEn: s.siteNameEn,
            tagline: s.tagline,
            logoPath: s.logoPath,
            logoAlt: s.logoAlt,
            faviconPath: s.faviconPath,
            blockAdminIndex: s.blockAdminIndex,

            phone: s.phone,
            whatsapp: s.whatsapp,
            whatsappMessage: s.whatsappMessage,
            email: s.email,
            address: s.address,
            city: s.city,
            country: s.country,
            mapEmbedUrl: s.mapEmbedUrl,
            mapLinkUrl: s.mapLinkUrl,
            hours: workingHours(s),
            socials: socialLinks(s) as Record<string, string>,

            heroBadge: s.heroBadge,
            heroTitle: s.heroTitle,
            heroDescription: s.heroDescription,
            heroImage: s.heroImage,
            heroImageAlt: s.heroImageAlt,
            homeAboutTitle: s.homeAboutTitle,
            homeAboutText: s.homeAboutText,
            homeAboutImage: s.homeAboutImage,
            homeAboutImageAlt: s.homeAboutImageAlt,
            homeServicesTitle: s.homeServicesTitle,
            homeServicesText: s.homeServicesText,
            homeServicesCtaText: s.homeServicesCtaText,
            homeProgramsTitle: s.homeProgramsTitle,
            homeProgramsText: s.homeProgramsText,
            homeBlogTitle: s.homeBlogTitle,
            homeBlogText: s.homeBlogText,
            homeTestimonialsTitle: s.homeTestimonialsTitle,
            homeFaqTitle: s.homeFaqTitle,
            homeFaqText: s.homeFaqText,
            finalCtaBadge: s.finalCtaBadge,
            finalCtaTitle: s.finalCtaTitle,
            finalCtaText: s.finalCtaText,

            aboutHeroTitle: s.aboutHeroTitle,
            aboutHeroText: s.aboutHeroText,
            aboutWhoTitle: s.aboutWhoTitle,
            aboutWhoText: s.aboutWhoText,
            aboutVisionTitle: s.aboutVisionTitle,
            aboutVisionText: s.aboutVisionText,
            aboutMissionTitle: s.aboutMissionTitle,
            aboutMissionText: s.aboutMissionText,
            aboutValuesTitle: s.aboutValuesTitle,
            aboutValuesText: s.aboutValuesText,
            aboutVision2030Title: s.aboutVision2030Title,
            aboutVision2030Text: s.aboutVision2030Text,
            aboutVision2030Image: s.aboutVision2030Image,
            aboutWhyTitle: s.aboutWhyTitle,
            aboutWhyText: s.aboutWhyText,

            seoTitle: s.seoTitle,
            seoDescription: s.seoDescription,
            seoKeywords: s.seoKeywords,
            ogImage: s.ogImage,
            analyticsCode: s.analyticsCode,

            notifyEmailEnabled: s.notifyEmailEnabled,
            notificationEmail: s.notificationEmail,
            notifyOnNewClient: s.notifyOnNewClient,
            notifyOnNewMessage: s.notifyOnNewMessage,
            notifyOnNewBooking: s.notifyOnNewBooking,

            primaryColor: s.primaryColor,
            accentColor: s.accentColor,
          }}
        />
      </div>
    </>
  );
}