import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { PageHero } from "@/components/site/common";
import { ContactForm, ContactChannels } from "./contact-form";
import { whatsappNumber } from "@/lib/crypto";
import { SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "تواصل معنا",
    description:
      "تواصل مع مركز سوار وعي للإحاطة بعلوم التعافي: استفسارات، حجز استشارة، أو تعاون مؤسسي. كل طلباتك سرّية.",
    alternates: { canonical: "/contact" },
    openGraph: {
      title: "تواصل معنا | سوار وعي",
      description: "راسل مركز سوار وعي أو احجز استشارة أولى للتقييم.",
    },
  };
}

const TOPICS = [
  {
    icon: Phone,
    title: "اتصال هاتفي",
    text: "أسهل طريقة إن كان الأمر يستدعي نقاشًا تفصيليًا.",
  },
  {
    icon: Mail,
    title: "بريد إلكتروني",
    text: "مناسب للتعاون المؤسسي وورش العمل والتدريبات.",
  },
  {
    icon: Clock,
    title: "خلال ساعات العمل",
    text: "من الأحد إلى الخميس، من ٩ صباحًا حتى ٩ مساءً.",
  },
];

export default async function ContactPage() {
  const settings = await getPublicSettings();
  const waNumber = whatsappNumber(settings.whatsapp || settings.phone);

  return (
    <>
      <PageHero
        eyebrow="نحن هنا"
        title="تواصل معنا"
        description="سواء كنت تسأل لنفسك أو لأحد أفراد أسرتك أو نيابة عن مؤسسة، ابدأ من هنا. كل ما تكتبه يبقى بينك وبين فريق المركز."
        crumbs={[{ label: "تواصل معنا" }]}
        compact
      />

      {/* ── Main ─────────────────────────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
            {/* Form */}
            <Reveal>
              <div className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-9">
                <SectionHeading
                  align="start"
                  title="أرسل لنا رسالة"
                  description="املأ النموذج وسيتواصل معك الفريق خلال ساعات العمل. البيانات مشفّرة ولا تُستخدم لأي غرض آخر."
                  className="mb-8"
                />
                <ContactForm />
              </div>
            </Reveal>

            {/* Channels */}
            <aside className="flex flex-col gap-5">
              <Reveal delay={100}>
                <ContactChannels
                  phone={settings.phone}
                  whatsappHref={
                    waNumber
                      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
                          settings.whatsappMessage ||
                            "السلام عليكم، أرغب في الاستفسار عن خدمات مركز سوار وعي.",
                        )}`
                      : null
                  }
                  email={settings.email}
                  hours={settings.hours}
                />
              </Reveal>

              {/* Address */}
              {(settings.address || settings.city) && (
                <Reveal delay={150}>
                  <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                    <h2 className="flex items-center gap-2 text-sm font-extrabold text-brand-900">
                      <MapPin className="size-4 text-gold-600" aria-hidden />
                      العنوان
                    </h2>
                    <p className="mt-3 text-[0.875rem] leading-[1.9] text-ink-600">
                      {[settings.address, settings.city, settings.country]
                        .filter(Boolean)
                        .join("، ")}
                    </p>
                    {settings.mapLinkUrl && (
                      <a
                        href={settings.mapLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-brand-700 hover:underline"
                      >
                        <MapPin className="size-3.5" aria-hidden />
                        عرض على الخريطة
                      </a>
                    )}
                  </div>
                </Reveal>
              )}

              {/* What happens next */}
              <Reveal delay={200}>
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
                  <h2 className="text-sm font-extrabold text-brand-900">
                    ماذا يحدث بعد الإرسال؟
                  </h2>
                  <ol className="mt-3.5 flex flex-col gap-3 text-[0.8125rem] leading-relaxed text-ink-700">
                    {[
                      "نراجع طلبك خلال ساعات العمل.",
                      "يتواصل معك أحد المختصين للاستماع إلى حالتك بفهم.",
                      "نحدّد معًا الخطوة الأنسب: استشارة، برنامج، أو إرشاد أسري.",
                    ].map((step, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-700 text-[0.625rem] font-extrabold text-white">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Map ──────────────────────────────────────── */}
      {settings.mapEmbedUrl && (
        <section className="pb-16">
          <div className="container-page">
            <SectionHeading title="موقعنا على الخريطة" className="mb-8" />
            <div className="aspect-video overflow-hidden rounded-3xl border border-sand-200 shadow-soft">
              <iframe
                src={settings.mapEmbedUrl}
                title="موقع مركز سوار وعي على الخريطة"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Channels explainer ───────────────────────── */}
      <section className="surface-purple py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading title="ما الطريقة الأنسب لك؟" className="mb-10" />
          <ul className="grid gap-5 md:grid-cols-3">
            {TOPICS.map((topic, index) => (
              <Reveal as="li" key={topic.title} delay={index * 80}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-6 text-center shadow-soft">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gold-50 text-gold-700">
                    <topic.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-extrabold text-brand-900">
                    {topic.title}
                  </h3>
                  <p className="text-[0.8125rem] leading-relaxed text-ink-600">
                    {topic.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>

        </div>
      </section>
    </>
  );
}

