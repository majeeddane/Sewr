import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Clock,
  Info,
  ListOrdered,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import {
  Badge,
  ButtonLink,
  IconChip,
  InteractiveCard,
  SectionHeading,
  chipToneFor,
} from "@/components/ui/primitives";
import { Accordion } from "@/components/ui/accordion";
import { PageHero, Prose } from "@/components/site/common";
import {
  getContentItemBySlug,
  getAllContentSlugs,
  type PublicContentItem,
} from "@/lib/queries";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/enums";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
//  Copy for the three content sections
// ═══════════════════════════════════════════════════════════════

export const CONTENT_COPY: Record<
  ContentType,
  {
    eyebrow: string;
    crumb: string;
    listTitle: string;
    listDescription: string;
    basePath: string;
  }
> = {
  SERVICE: {
    eyebrow: "خدماتنا",
    crumb: "خدماتنا",
    listTitle: "خدمات متكاملة لرحلة تعافٍ مستدامة",
    listDescription:
      "يقدم سوار وعي خدمات متكاملة في مجال علاج الإدمان والاضطرابات النفسية والسلوكية، ونسعى لتوجيه كل شخص إلى ما يناسبه من برامج وخدمات. وكل خدمة تبدأ بتقييم فردي تُبنى عليه الخطة.",
    basePath: "/services",
  },
  PROGRAM: {
    eyebrow: "برامجنا",
    crumb: "برامجنا",
    listTitle: "برامج إعادة التأهيل والعلاج المساعد",
    listDescription:
      "برامج متكاملة تمرّ بمراحل واضحة: من التقييم والتهيئة، إلى تعديل السلوك، ثم إعادة التأهيل النفسي والاجتماعي والديني والترويحي، وصولاً إلى المتابعة طويلة المدى.",
    basePath: "/programs",
  },
  PROTOCOL: {
    eyebrow: "البروتوكولات العلاجية",
    crumb: "البروتوكولات العلاجية",
    listTitle: "البروتوكولات العلاجية والإرشادية",
    listDescription:
      "أطر عمل واضحة نلتزم بها في مختلف تخصّصاتنا: العلاج الدوائي، وعلم النفس الإكلينيكي، والخدمة الاجتماعية، وإرشاد التعافي، والإرشاد الديني. ويوضّح كل بروتوكول دور المركز وما هو خارج نطاقه.",
    basePath: "/protocols",
  },
};

// ═══════════════════════════════════════════════════════════════
//  LIST
// ═══════════════════════════════════════════════════════════════

export function ContentListing({
  type,
  eyebrow,
  title,
  description,
  items,
  emptyHint,
}: {
  type: ContentType;
  eyebrow: string;
  title: string;
  description: string;
  items: PublicContentItem[];
  emptyHint?: string;
}) {
  const base = type === "SERVICE" ? "/services" : type === "PROGRAM" ? "/programs" : "/protocols";

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        crumbs={[{ label: title }]}
        compact
      />

      <section className="py-16 sm:py-20">
        <div className="container-page">
          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-sand-300 px-6 py-16 text-center text-ink-500">
              {emptyHint ?? "لا يوجد محتوى منشور في هذا القسم بعد."}
            </p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item, index) => (
                <Reveal as="li" key={item.id} delay={(index % 6) * 70}>
                  <Link href={`${base}/${item.slug}`} className="block h-full">
                    <InteractiveCard className="flex h-full flex-col p-6">
                      <div className="flex items-start justify-between gap-3">
                        <IconChip icon={item.icon} tone={chipToneFor(index)} size="md" />
                        {item.durationLabel && (
                          <span className="flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-[0.6875rem] font-bold text-ink-500">
                            <Clock className="size-3" aria-hidden />
                            {item.durationLabel}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-4 text-lg leading-snug text-brand-900">
                        {item.title}
                      </h2>
                      <p className="mt-2.5 line-clamp-4 flex-1 text-[0.9375rem] leading-[1.9] text-ink-600">
                        {item.shortDescription}
                      </p>

                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 transition-colors group-hover:text-brand-900">
                        التفاصيل
                        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
                      </span>
                    </InteractiveCard>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DETAIL
// ═══════════════════════════════════════════════════════════════

function BulletBlock({
  title,
  Icon,
  items,
  tone = "brand",
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  items: string[];
  tone?: "brand" | "gold";
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
      <h2 className="flex items-center gap-2.5 text-lg text-brand-900">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl",
            tone === "gold"
              ? "bg-gold-50 text-gold-700"
              : "bg-brand-50 text-brand-700",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        {title}
      </h2>
      <ul className="mt-5 flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5 text-[0.9375rem] leading-[1.9] text-ink-700">
            <span
              aria-hidden
              className={cn(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-full",
                tone === "gold"
                  ? "bg-gold-100 text-gold-700"
                  : "bg-brand-100 text-brand-700",
              )}
            >
              <Check className="size-3" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function ContentDetail({
  type,
  slug,
  related,
}: {
  type: ContentType;
  slug: string;
  related?: PublicContentItem[];
}) {
  const item = await getContentItemBySlug(type, slug);
  if (!item) notFound();

  const base = type === "SERVICE" ? "/services" : type === "PROGRAM" ? "/programs" : "/protocols";
  const typeLabel = CONTENT_TYPE_LABELS[type];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: item.title,
    description: item.shortDescription,
    areaServed: "المملكة العربية السعودية",
    availableLanguage: "ar",
    ...(item.seoTitle ? { headline: item.seoTitle } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        eyebrow={typeLabel}
        title={item.title}
        description={item.shortDescription}
        crumbs={[
          { label: base === "/services" ? "خدماتنا" : base === "/programs" ? "برامجنا" : "البروتوكولات", href: base },
          { label: item.title },
        ]}
      >
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <ButtonLink href="/book" variant="gold" size="md" icon="CalendarCheck">
            احجز استشارة
          </ButtonLink>
          <ButtonLink href="/contact" variant="white" size="md" icon="MessageCircle">
            تواصل معنا
          </ButtonLink>
          {item.durationLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[0.8125rem] font-bold text-brand-100 ring-1 ring-inset ring-white/15">
              <Clock className="size-3.5" aria-hidden />
              {item.durationLabel}
            </span>
          )}
        </div>
      </PageHero>

      <article className="py-14 sm:py-20">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
            {/* ── Main column ─────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-10">
              {item.audience && (
                <section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-6">
                  <h2 className="flex items-center gap-2.5 text-lg text-brand-900">
                    <span className="grid size-9 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                      <Target className="size-4.5" aria-hidden />
                    </span>
                    لمن تناسب هذه الخدمة؟
                  </h2>
                  <p className="mt-3.5 whitespace-pre-line text-[0.9375rem] leading-[1.95] text-ink-700">
                    {item.audience}
                  </p>
                </section>
              )}

              <Prose html={item.fullDescription} />

              {item.steps.length > 0 && (
                <section>
                  <SectionHeading
                    title="كيف تسير الخطوات"
                    align="start"
                    className="mb-7"
                  />
                  <ol className="flex flex-col gap-5">
                    {item.steps.map((step, index) => (
                      <Reveal as="li" key={index} delay={index * 60}>
                        <div className="flex gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-800 font-extrabold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <h3 className="text-base font-extrabold text-brand-900">
                              {step.title}
                            </h3>
                            <p className="mt-1.5 text-[0.9375rem] leading-[1.9] text-ink-600">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </ol>
                </section>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <BulletBlock
                  title="ماذا يقدّم لك"
                  Icon={Check}
                  items={item.benefits}
                />
                <BulletBlock
                  title="مخرجات متوقعة"
                  Icon={Target}
                  items={item.outcomes}
                  tone="gold"
                />
              </div>

              {item.notes.length > 0 && (
                <section className="rounded-2xl border border-gold-200 bg-gold-50/70 p-6">
                  <h2 className="flex items-center gap-2.5 text-lg text-brand-900">
                    <span className="grid size-9 place-items-center rounded-xl bg-white text-gold-700 shadow-sm">
                      <Info className="size-4.5" aria-hidden />
                    </span>
                  </h2>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {item.notes.map((note, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2.5 text-[0.9375rem] leading-[1.9] text-ink-700"
                      >
                        <TriangleAlert
                          className="mt-1 size-4 shrink-0 text-gold-600"
                          aria-hidden
                        />
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {item.faqs.length > 0 && (
                <section>
                  <SectionHeading
                    title="أسئلة شائعة"
                    align="start"
                    className="mb-7"
                  />
                  <Accordion items={item.faqs} />
                </section>
              )}

              {/* Booking CTA */}
              <section className="relative overflow-hidden rounded-2xl panel-purple px-7 py-10 sm:px-10">
                <div
                  aria-hidden
                  className="absolute -bottom-20 -start-8 size-56 rounded-full bg-gold-500/20 blur-3xl"
                />
                <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl text-white sm:text-2xl">
                      هل تناسبك هذه {typeLabel.toLowerCase()}؟
                    </h2>
                    <p className="mt-2.5 max-w-lg text-[0.9375rem] leading-relaxed text-brand-100">
                      احجز استشارة أولى للتقييم، وسنحدّد معك الخطوة الأنسب دون
                      أي التزام.
                    </p>
                  </div>
                  <ButtonLink href="/book" variant="gold" size="lg" icon="CalendarCheck">
                    احجز استشارة
                  </ButtonLink>
                </div>
              </section>
            </div>

            {/* ── Sidebar ─────────────────────────────── */}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
                <h2 className="text-base font-extrabold text-brand-900">
                  روابط سريعة
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5 text-[0.875rem]">
                  <li>
                    <Link
                      href={base}
                      className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-900"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden />
                      كل {typeLabel === "خدمة" ? "الخدمات" : typeLabel === "برنامج" ? "البرامج" : "البروتوكولات"}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-900"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden />
                      تواصل معنا
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy"
                      className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-900"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden />
                      سياسة الخصوصية
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-sand-200 bg-sand-50 p-6">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-brand-900">
                  <ListOrdered className="size-4 text-gold-600" aria-hidden />
                  تذكير
                </h2>
                <p className="mt-3 text-[0.8125rem] leading-[1.9] text-ink-600">
                  هذه الصفحة للتوعية فقط، ولا تُغني عن التقييم الفردي ولا عن
                  استشارة الطبيب المختص عند الحاجة.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </article>

      {/* ── Related ─────────────────────────────────── */}
      {related && related.length > 0 && (
        <section className="surface-purple py-16 sm:py-20">
          <div className="container-page">
            <SectionHeading
              title={`${typeLabel === "خدمة" ? "خدمات" : typeLabel === "برنامج" ? "برامج" : "بروتوكولات"} ذات صلة`}
              className="mb-10"
            />
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {related.map((rel, index) => (
                <Reveal as="li" key={rel.id} delay={index * 70}>
                  <Link href={`${base}/${rel.slug}`}>
                    <InteractiveCard className="flex h-full flex-col p-6">
                      <IconChip icon={rel.icon} tone={chipToneFor(index)} size="sm" />
                      <h3 className="mt-4 text-base leading-snug text-brand-900">
                        {rel.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-[0.875rem] leading-[1.9] text-ink-600">
                        {rel.shortDescription}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-brand-700">
                        التفاصيل
                        <ChevronLeft className="size-3.5" aria-hidden />
                      </span>
                    </InteractiveCard>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

/** Pre-render every active slug at build time. */
export async function buildStaticParamsFor(type: ContentType) {
  const slugs = await getAllContentSlugs(type);
  return slugs.map(({ slug }) => ({ slug }));
}

/** Badge helper reused by listing pages. */
export function TypeBadge({ type }: { type: ContentType }) {
  return <Badge tone="brand">{CONTENT_TYPE_LABELS[type]}</Badge>;
}
