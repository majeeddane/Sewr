import type { Metadata } from "next";
import { PageHero } from "@/components/site/common";
import { Reveal } from "@/components/ui/reveal";
import {
  ButtonLink,
  IconChip,
  SectionHeading,
  chipToneFor,
} from "@/components/ui/primitives";
import { CtaBanner } from "@/components/site/sections";
import { getSiteSettings } from "@/lib/settings";
import { getValueItems, getWhyItems } from "@/lib/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.aboutHeroTitle || "من نحن",
    description: settings.aboutHeroText || undefined,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [settings, values, why] = await Promise.all([
    getSiteSettings(),
    getValueItems(),
    getWhyItems(),
  ]);

  const pillars = [
    {
      key: "vision",
      title: settings.aboutVisionTitle || "رؤيتنا",
      text: settings.aboutVisionText || "",
      icon: "Send" as const,
      tone: "gold" as const,
    },
    {
      key: "mission",
      title: settings.aboutMissionTitle || "رسالتنا",
      text: settings.aboutMissionText || "",
      icon: "HeartHandshake" as const,
      tone: "brand" as const,
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="عن المركز"
        title={settings.aboutHeroTitle || "من نحن"}
        description={settings.aboutHeroText || undefined}
        crumbs={[{ label: "من نحن" }]}
      />

      {/* ── Who we are ──────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
            <div className="min-w-0">
              <SectionHeading
                align="start"
                title={settings.aboutWhoTitle || "من نحن"}
                className="mb-7"
              />
              <p className="whitespace-pre-line text-[1.0625rem] leading-[2.1] text-ink-700">
                {settings.aboutWhoText || ""}
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <ButtonLink href="/book" variant="gold" size="lg" icon="CalendarCheck">
                  احجز استشارة
                </ButtonLink>
                <ButtonLink href="/services" variant="outline" size="lg">
                  تعرّف على خدماتنا
                </ButtonLink>
              </div>
            </div>

            {/* Vision & mission */}
            <div className="flex flex-col gap-5">
              {pillars.map((pillar, index) => (
                <Reveal key={pillar.key} delay={index * 90}>
                  <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
                    <div className="flex items-center gap-3">
                      <IconChip icon={pillar.icon} tone={pillar.tone} size="sm" />
                      <h2 className="text-lg text-brand-900">{pillar.title}</h2>
                    </div>
                    <p className="mt-4 whitespace-pre-line text-[0.9375rem] leading-[1.95] text-ink-600">
                      {pillar.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────── */}
      {values.length > 0 && (
        <section className="surface-purple py-20 sm:py-24">
          <div className="container-page">
            <SectionHeading
              eyebrow={settings.aboutValuesTitle || "قيمنا"}
              title={settings.aboutValuesTitle || "قيمنا"}
              description={settings.aboutValuesText}
              className="mb-12"
            />
            <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
              {values.map((value, index) => (
                <Reveal as="li" key={value.id} delay={index * 70}>
                  <div className="group flex flex-col items-center gap-3 text-center">
                    <IconChip icon={value.icon} tone="gold" size="lg" />
                    <h3 className="text-base font-extrabold text-brand-900">
                      {value.title}
                    </h3>
                    <p className="text-[0.8125rem] leading-relaxed text-ink-600">
                      {value.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Vision 2030 ─────────────────────────────── */}
      {settings.aboutVision2030Text && (
        <section className="bg-sand-50 py-20 sm:py-24">
          <div className="container-page">
            <Reveal>
              <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border border-sand-200 bg-white shadow-soft lg:grid-cols-2">
                <div className="p-7 sm:p-12">
                  <span className="eyebrow">رؤية المملكة ٢٠٣٠</span>
                  <h2 className="mt-5 text-2xl leading-tight text-brand-900 sm:text-3xl">
                    {settings.aboutVision2030Title || "ارتباطنا برؤية 2030"}
                  </h2>
                  <p className="mt-4 text-[1.0625rem] leading-[2] text-ink-600">
                    {settings.aboutVision2030Text}
                  </p>
                </div>
                <div className="relative min-h-[16rem] bg-brand-50 lg:min-h-full">
                  <div className="absolute inset-0 bg-dots opacity-40" />
                  <div className="absolute inset-0 grid place-items-center p-10">
                    <span className="text-center">
                      <span className="block text-5xl font-extrabold text-brand-700">
                        ٢٠٣٠
                      </span>
                      <span className="mt-2 block text-sm font-bold text-ink-500">
                        رؤية وطنية نتشارك في تحقيقها
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Why choose us ───────────────────────────── */}
      {why.length > 0 && (
        <section className="bg-sand-50 py-20 sm:py-24">
          <div className="container-page">
            <SectionHeading
              eyebrow="لماذا تختارنا"
              title={settings.aboutWhyTitle || "لماذا تختارنا"}
              description={settings.aboutWhyText}
              className="mb-12"
            />
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {why.map((item, index) => (
                <Reveal as="li" key={item.id} delay={index * 70}>
                  <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-sand-200 bg-white p-6 text-center shadow-soft">
                    <IconChip icon={item.icon} tone={chipToneFor(index + 1)} size="md" />
                    <h3 className="text-base font-extrabold text-brand-900">
                      {item.title}
                    </h3>
                    <p className="text-[0.8125rem] leading-relaxed text-ink-600">
                      {item.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBanner
        badge="خطوة تالية"
        title="التغيير ممكن.. ونحن هنا لدعمك"
        text="لا تحتاج أن تعرف من أين تبدأ. ابدأ باستشارة أولى للتقييم، وسنرافقك خطوة بخطوة."
        image="/placeholders/cta-hands.svg"
      />

    </>
  );
}
