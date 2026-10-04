import * as React from "react";
import Link from "next/link";
import {
  Mail,
  MapPin,
  Phone,
  Clock,
  MessageCircle,
  Send,
} from "lucide-react";
import { Logo } from "./logo";
import { SOCIAL_ICONS, SOCIAL_KEYS } from "./social-icons";
import { getPublicSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/crypto";
import { getContentCounts } from "@/lib/queries";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_META = SOCIAL_KEYS.map((key) => ({
  key,
  label: SOCIAL_ICONS[key].label,
  Icon: SOCIAL_ICONS[key].Icon,
}));

export async function SiteFooter() {
  const settings = await getPublicSettings();
  const counts = await getContentCounts();
  const year = new Date().getFullYear();

  const quickLinks = [
    { href: "/about", label: "من نحن" },
    { href: "/services", label: "خدماتنا" },
    { href: "/programs", label: "برامجنا" },
    { href: "/protocols", label: "البروتوكولات العلاجية" },
    { href: "/blog", label: "المدونة" },
    { href: "/contact", label: "تواصل معنا" },
  ];

  const legalLinks = [
    { href: "/privacy", label: "سياسة الخصوصية" },
    { href: "/terms", label: "الشروط والأحكام" },
    { href: "/book", label: "احجز استشارة" },
  ];

  return (
    <footer className="relative mt-24 overflow-hidden bg-brand-950 text-brand-100">
      {/* Decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 start-1/4 size-[28rem] rounded-full bg-brand-700/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 end-0 size-[26rem] rounded-full bg-gold-600/12 blur-3xl"
      />

      <div className="container-page relative py-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Brand ─────────────────────────────────── */}
          <div className="lg:col-span-4">
            <Logo variant="dark" logoPath={settings.logoPath} size={48} />
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-[1.95] text-brand-200/90">
              مركز متخصص في الإحاطة بعلوم التعافي، يجمع بين الرعاية النفسية
              والعلمية والإرشاد الأسري، ليقدّم رعاية تحفظ كرامة كل من يطلب
              المساعدة وتضع التعافي أولوياتها.
            </p>

            {settings.socials && Object.keys(settings.socials).length > 0 && (
              <ul className="mt-6 flex flex-wrap items-center gap-2.5">
                {SOCIAL_META.map(({ key, label, Icon }) => {
                  const href = settings.socials[key as keyof typeof settings.socials];
                  if (!href) return null;
                  return (
                    <li key={key}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        aria-label={label}
                        title={label}
                        className="grid size-10 place-items-center rounded-xl bg-white/8 text-brand-100 ring-1 ring-inset ring-white/10 transition-all hover:bg-white/15 hover:text-gold-300"
                      >
                        <Icon className="size-4.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Quick links ────────────────────────────── */}
          <nav aria-label="روابط سريعة" className="lg:col-span-2">
            <h2 className="text-base font-extrabold text-white">روابط سريعة</h2>
            <span aria-hidden className="mt-3 block h-1 w-10 rounded-full bg-gold-400" />
            <ul className="mt-5 flex flex-col gap-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-2 text-[0.9375rem] text-brand-200/90 transition-colors hover:text-gold-300"
                  >
                    <span
                      aria-hidden
                      className="size-1 rounded-full bg-gold-400 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Services count ─────────────────────────── */}
          <nav aria-label="المحتوى" className="lg:col-span-2">
            <h2 className="text-base font-extrabold text-white">المركز في سطور</h2>
            <span aria-hidden className="mt-3 block h-1 w-10 rounded-full bg-gold-400" />
            <ul className="mt-5 flex flex-col gap-3">
              {[
                { label: "خدمة علاجية وإرشادية", value: `${counts.services} خدمات` },
                { label: "برنامج إعادة تأهيل", value: `${counts.programs} برامج` },
                { label: "بروتوكول علاجي", value: `${counts.protocols} بروتوكولات` },
                { label: "مقال في المدونة", value: `${counts.posts} مقالات` },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 text-[0.9375rem] text-brand-200/90"
                >
                  <span>{item.label}</span>
                  <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-bold text-gold-300">
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Contact ────────────────────────────────── */}
          <div className="lg:col-span-4">
            <h2 className="text-base font-extrabold text-white">معلومات التواصل</h2>
            <span aria-hidden className="mt-3 block h-1 w-10 rounded-full bg-gold-400" />
            <ul className="mt-5 flex flex-col gap-4 text-[0.9375rem]">
              {settings.phone && (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-gold-300">
                    <Phone className="size-4" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs text-brand-300">الهاتف / واتساب</span>
                    <a
                      href={`tel:${settings.phone}`}
                      dir="ltr"
                      className="font-bold text-white hover:text-gold-300"
                    >
                      {formatPhone(settings.phone)}
                    </a>
                  </span>
                </li>
              )}
              {settings.email && (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-gold-300">
                    <Mail className="size-4" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs text-brand-300">البريد الإلكتروني</span>
                    <a
                      href={`mailto:${settings.email}`}
                      className="font-bold text-white hover:text-gold-300"
                    >
                      {settings.email}
                    </a>
                  </span>
                </li>
              )}
              {(settings.address || settings.city) && (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-gold-300">
                    <MapPin className="size-4" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xs text-brand-300">العنوان</span>
                    <span className="leading-relaxed text-white">
                      {[settings.address, settings.city, settings.country]
                        .filter(Boolean)
                        .join("، ")}
                    </span>
                    {settings.mapLinkUrl && (
                      <a
                        href={settings.mapLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-gold-300 hover:underline"
                      >
                        <MapPin className="size-3" aria-hidden />
                        عرض على الخريطة
                      </a>
                    )}
                  </span>
                </li>
              )}
            </ul>

            {settings.hours.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white/6 p-5 ring-1 ring-inset ring-white/10">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <Clock className="size-4 text-gold-300" aria-hidden />
                  ساعات العمل
                </h3>
                <dl className="mt-3 flex flex-col gap-2 text-[0.8125rem]">
                  {settings.hours.map((row) => (
                    <div key={row.day} className="flex items-center justify-between gap-3">
                      <dt className="text-brand-200">{row.day}</dt>
                      <dd className="font-bold text-white">{row.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* ── Newsletter ──────────────────────────────── */}
        <div className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm sm:p-9">
          <div className="grid items-center gap-7 lg:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2.5 text-xl font-extrabold text-white">
                <Send className="size-5 text-gold-400" aria-hidden />
                اشترك في نشرة سوار وعي
              </h2>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-brand-200">
                ملخّص شهري واحد فقط: مقالات توعوية، نصائح عملية، ومواعيد ورش
                قادمة. بلا إزعاج، ويمكنك إلغاء الاشتراك في أي وقت.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────── */}
        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-center text-[0.8125rem] text-brand-300 md:start-0 md:text-start">
            © <span dir="ltr">{year}</span> سوار وعي — جميع الحقوق محفوظة.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[0.8125rem] text-brand-300 transition-colors hover:text-gold-300"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-brand-400/70 transition-colors hover:text-brand-300"
              >
                <MessageCircle className="size-3" aria-hidden />
                دخول الإدارة
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
