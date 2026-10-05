import type { Metadata } from "next";

import { Hero } from "@/components/site/hero";
import {
  AboutTeaser,
  BlogCard,
  CtaBanner,
  Methodology,
  ProgramBanner,
  StatsBand,
  Testimonials,
} from "@/components/site/sections";
import { Accordion } from "@/components/ui/accordion";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink, IconChip, InteractiveCard, SectionHeading, chipToneFor } from "@/components/ui/primitives";
import { getSiteSettings, socialLinks } from "@/lib/settings";
import {
  getContentItems,
  getFaqs,
  getProcessSteps,
  getPublishedPosts,
  getStatistics,
  getTestimonials,
  getTrustItems,
  getValueItems,
  getWhyItems,
} from "@/lib/queries";
import { CONTENT_TYPE_PATHS } from "@/lib/enums";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.seoTitle || `${settings.siteName} — ${settings.tagline}`,
    description: settings.seoDescription || undefined,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [settings, trust, services, steps, values, why, stats, testimonials, faqs, posts] =
    await Promise.all([
      getSiteSettings(),
      getTrustItems(),
      getContentItems("SERVICE"),
      getProcessSteps(),
      getValueItems(),
      getWhyItems(),
      getStatistics(),
      getTestimonials(),
      getFaqs(),
      getPublishedPosts({ limit: 3 }),
    ]);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalBusiness",
        "@id": `${siteUrl}/#organization`,
        name: settings.siteName,
        alternateName: settings.siteNameEn,
        description: settings.seoDescription ?? settings.tagline,
        url: siteUrl,
        telephone: settings.phone ?? undefined,
        email: settings.email ?? undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: settings.address ?? undefined,
          addressLocality: settings.city ?? undefined,
          addressCountry: "SA",
        },
        areaServed: { "@type": "Country", name: "المملكة العربية السعودية" },
        availableLanguage: { "@type": "Language", name: "Arabic", alternateName: "ar" },
        sameAs: Object.values(socialLinks).filter(Boolean),
        slogan: settings.finalCtaTitle ?? undefined,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: settings.siteName,
        inLanguage: "ar-SA",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/blog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero
        badge={settings.heroBadge}
        title={settings.heroTitle ?? settings.siteName}
        description={settings.heroDescription}
        image={settings.heroImage}
        imageAlt={settings.heroImageAlt}
          imageHidden={settings.heroImageHidden}
        trustItems={trust.map((t) => ({
          title: t.title,
          description: t.description,
          icon: t.icon,
        }))}
      />

      <AboutTeaser
        title={settings.homeAboutTitle ?? "من نحن"}
        text={settings.homeAboutText ?? ""}
        image={settings.homeAboutImage}
        imageAlt={settings.homeAboutImageAlt ?? ""}
          imageHidden={settings.homeAboutImageHidden}
        vision={settings.aboutVisionText}
        mission={settings.aboutMissionText}
        visionTitle={settings.aboutVisionTitle}
        missionTitle={settings.aboutMissionTitle}
        ctaLabel="المزيد عن سوار وعي"
      />

      {/* ── Services ─────────────────────────────────── */}
      <section className="bg-sand-50 py-20 sm:py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="خدماتنا"
            title={settings.homeServicesTitle ?? "خدمات متكاملة"}
            description={settings.homeServicesText}
            action={
              <ButtonLink
                href={CONTENT_TYPE_PATHS.SERVICE}
                variant="outline"
                size="md"
                iconEnd="ChevronLeft"
              >
                {settings.homeServicesCtaText ?? "كل الخدمات"}
              </ButtonLink>
            }
            className="mb-12"
          />

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {services.slice(0, 10).map((item, index) => (
              <Reveal as="li" key={item.id} delay={(index % 5) * 70}>
                <InteractiveCard className="flex h-full flex-col p-5">
                  <IconChip icon={item.icon} tone={chipToneFor(index)} size="md" />
                  <h3 className="mt-4 text-[0.9375rem] font-extrabold leading-snug text-brand-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-[0.8125rem] leading-[1.85] text-ink-500">
                    {item.shortDescription}
                  </p>
                </InteractiveCard>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Methodology ──────────────────────────────── */}
      <Methodology
        title={settings.homeProgramsTitle ?? "منهجية التعافي"}
        text={settings.homeProgramsText ?? ""}
        image={settings.aboutVision2030Image ?? "/placeholders/vision2030.svg"}
          imageHidden={settings.aboutVision2030ImageHidden}
        steps={steps.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          icon: s.icon,
        }))}
      />

      {/* ── Values ──────────────────────────────────── */}
      <section className="bg-sand-50 py-20 sm:py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="قيمنا"
            title={settings.aboutValuesTitle ?? "قيمنا"}
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
                  <p className="text-[0.8125rem] leading-relaxed text-ink-500">
                    {value.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Programs banner ─────────────────────────── */}
      <ProgramBanner
        title={settings.homeProgramsTitle ?? "برامجنا"}
        text={settings.homeProgramsText ?? ""}
        image="/placeholders/program-matrix.svg"
        href={CONTENT_TYPE_PATHS.PROGRAM}
      />

      {/* ── Statistics ───────────────────────────────── */}
      <StatsBand
        stats={stats.map((s) => ({
          id: s.id,
          label: s.label,
          value: s.value,
          prefix: s.prefix,
          suffix: s.suffix,
          icon: s.icon,
          isHighlight: s.isHighlight,
        }))}
      />

      {/* ── Why choose us ────────────────────────────── */}
      {why.length > 0 && (
        <section className="surface-purple py-20 sm:py-24">
          <div className="container-page">
            <SectionHeading
              eyebrow="لماذا تختارنا"
              title={settings.aboutWhyTitle ?? "لماذا تختارنا"}
              description={settings.aboutWhyText}
              className="mb-12"
            />
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {why.map((item, index) => (
                <Reveal as="li" key={item.id} delay={index * 70}>
                  <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-sand-200 bg-white p-6 text-center shadow-soft">
                    <IconChip icon={item.icon} tone={chipToneFor(index + 2)} size="md" />
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

      {/* ── Blog ─────────────────────────────────────── */}
      {posts.length > 0 && (
        <section className="bg-sand-50 py-20 sm:py-24">
          <div className="container-page">
            <SectionHeading
              eyebrow="المدونة"
              title={settings.homeBlogTitle ?? "من المدونة"}
              description={settings.homeBlogText}
              action={
                <ButtonLink
                  href="/blog"
                  variant="outline"
                  size="md"
                  iconEnd="ChevronLeft"
                >
                  كل المقالات
                </ButtonLink>
              }
              className="mb-12"
            />
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <Reveal as="li" key={post.id} delay={index * 80}>
                  <BlogCard post={post} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Testimonials ─────────────────────────────── */}
      <Testimonials
        title={settings.homeTestimonialsTitle ?? undefined}
        items={testimonials.map((t) => ({
          id: t.id,
          quote: t.quote,
          authorName: t.authorName,
          authorRole: t.authorRole,
          rating: t.rating,
          isAnonymous: t.isAnonymous,
        }))}
      />

      {/* ── FAQ ──────────────────────────────────────── */}
      {faqs.length > 0 && (
        <section className="bg-sand-50 py-20 sm:py-24">
          <div className="container-page">
            <SectionHeading
              eyebrow="الأسئلة الشائعة"
              title={settings.homeFaqTitle ?? "أسئلة يطرحها كثيرون"}
              description={settings.homeFaqText}
              className="mb-10"
            />
            <div className="mx-auto max-w-3xl">
              <Accordion
                items={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
              />
            </div>
          </div>
        </section>
      )}

      <CtaBanner
        badge={settings.finalCtaBadge}
        title={settings.finalCtaTitle ?? "التغيير ممكن"}
        text={settings.finalCtaText ?? ""}
        image="/placeholders/cta-hands.svg"
      />
    </>
  );
}

