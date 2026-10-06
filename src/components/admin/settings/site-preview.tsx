import * as React from "react";
import { CalendarCheck, ExternalLink, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

/**
 * Compact mock of the public header, rendered from the **saved** settings.
 *
 * The owner sees the effect of a name / logo / colour change before opening
 * the public site, which is the whole point of putting it above the tabs.
 */
export function SitePreviewStrip({
  siteName,
  siteNameEn,
  tagline,
  logoPath,
  logoIncludesName,
  phone,
  primaryColor,
  accentColor,
}: {
  siteName: string;
  siteNameEn: string;
  tagline: string;
  logoPath: string | null;
  logoIncludesName: boolean;
  phone: string | null;
  primaryColor: string;
  accentColor: string;
}) {
  return (
    <section
      aria-label="معاينة رأس الموقع"
      className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-center gap-2 border-b border-sand-200 bg-sand-50 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        <span className="size-2 rounded-full bg-success-500" aria-hidden />
        <p className="text-xs font-bold text-ink-500 dark:text-ink-400">
          معاينة حيّة — تُعرض القيم المحفوظة حاليًا
        </p>
      </div>

      {/* Announcement strip */}
      <div
        className="px-4 py-2 text-center text-[0.8125rem] text-white"
        style={{ backgroundColor: primaryColor }}
      >
        استشارة أولى مجانية للتقييم — اتصل بنا على{" "}
        <span className="font-bold" style={{ color: accentColor }} dir="ltr">
          {phone || "الرقم المعلن في الموقع"}
        </span>
      </div>

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo
          logoPath={logoPath}
          logoIncludesName={logoIncludesName}
          siteName={siteName}
          siteNameEn={siteNameEn}
          size={40}
        />
          <span className="flex flex-col">
            <span className="text-base font-extrabold text-brand-900 dark:text-white">
              {siteName}
            </span>
            <span className="text-xs text-ink-500 dark:text-ink-400">{tagline}</span>
          </span>
        </div>

        <nav aria-label="روابط المعاينة" className="hidden items-center gap-1 md:flex">
          {["الرئيسية", "من نحن", "خدماتنا", "برامجنا", "المدونة", "تواصل معنا"].map((item, index) => (
            <span
              key={item}
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.8125rem] font-bold",
                index === 0
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
                  : "text-ink-500 dark:text-ink-400",
              )}
            >
              {item}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[0.8125rem] font-bold text-brand-950"
            style={{ backgroundColor: accentColor }}
          >
            <CalendarCheck className="size-4" aria-hidden />
            احجز استشارة
          </span>
          <span
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[0.8125rem] font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="size-4" aria-hidden />
            تواصل معنا
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 px-4 py-2.5 text-xs text-ink-500 dark:border-white/10 dark:text-ink-400">
        <span className="flex items-center gap-1.5">
          <Phone className="size-3.5" aria-hidden />
          الاسم بالإنجليزية: <span dir="ltr">{siteNameEn}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-4 rounded-full border border-sand-300"
            style={{ backgroundColor: primaryColor }}
          />
          <span
            aria-hidden
            className="size-4 rounded-full border border-sand-300"
            style={{ backgroundColor: accentColor }}
          />
          الألوان الحالية
        </span>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline dark:text-brand-300"
        >
          معاينة الصفحة الرئيسية
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}