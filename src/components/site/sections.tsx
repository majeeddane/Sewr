import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Clock, Star, Quote, CalendarDays, ArrowLeft } from "lucide-react";
import { Reveal, Counter } from "@/components/ui/reveal";
import { Badge, ButtonLink, IconChip, InteractiveCard, SectionHeading, chipToneFor } from "@/components/ui/primitives";
import { getIcon } from "@/lib/icons";
import { cn, formatDate, numericPart, nonNumericPart } from "@/lib/utils";
import type { PublicContentItem, PublicPost } from "@/lib/queries";

// ═══════════════════════════════════════════════════════════════
//  Cards
// ═══════════════════════════════════════════════════════════════

export function ContentCard({
  item,
  href,
  ctaLabel = "التفاصيل",
}: {
  item: PublicContentItem;
  href: string;
  ctaLabel?: string;
}) {
  return (
    <InteractiveCard className="flex h-full flex-col p-6">
      <IconChip icon={item.icon} tone={chipToneFor(item.order)} size="md" />
      <h3 className="mt-4 text-lg leading-snug text-brand-900">{item.title}</h3>
      <p className="mt-2.5 line-clamp-3 flex-1 text-[0.9375rem] leading-[1.9] text-ink-600">
        {item.shortDescription}
      </p>

      {item.durationLabel && (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-400">
          <Clock className="size-3.5" aria-hidden />
          {item.durationLabel}
        </p>
      )}

      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 transition-colors hover:text-brand-900"
      >
        {ctaLabel}
        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
      </Link>
    </InteractiveCard>
  );
}

export function BlogCard({
  post,
  featured = false,
}: {
  post: PublicPost;
  featured?: boolean;
}) {
  return (
    <InteractiveCard
      className={cn(
        "group flex h-full flex-col overflow-hidden",
        featured && "sm:flex-row",
      )}
    >
      {(!post.coverHidden || post.coverImage) && (
        <Link
          href={`/blog/${post.slug}`}
          className={cn(
            "relative block overflow-hidden bg-brand-900",
            featured ? "sm:w-1/2" : "",
            "aspect-[16/10]",
          )}
          tabIndex={-1}
          aria-hidden
        >
          <Image
            src={post.coverImage || "/placeholders/cover-fallback.svg"}
            alt=""
            fill
            sizes={featured ? "(min-width: 640px) 30vw, 100vw" : "(min-width: 1024px) 30vw, 100vw"}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>
      )}

      <div className={cn("flex flex-1 flex-col p-6", featured && "sm:w-1/2 sm:justify-center sm:p-8")}>
        <div className="flex flex-wrap items-center gap-2">
          {post.category && (
            <Badge tone="brand">{post.category.name}</Badge>
          )}
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatDate(post.publishedAt)}
          </span>
          <span aria-hidden className="text-ink-300">·</span>
          <span className="text-xs text-ink-400">{post.readingMinutes} دقائق قراءة</span>
        </div>

        <h3
          className={cn(
            "mt-3 leading-snug text-brand-900",
            featured ? "text-xl sm:text-2xl" : "text-lg",
          )}
        >
          <Link href={`/blog/${post.slug}`} className="hover:text-brand-700">
            {post.title}
          </Link>
        </h3>

        <p
          className={cn(
            "mt-2.5 flex-1 leading-[1.95] text-ink-600",
            featured ? "line-clamp-4 text-[0.9375rem]" : "line-clamp-3 text-[0.875rem]",
          )}
        >
          {post.excerpt}
        </p>

        <Link
          href={`/blog/${post.slug}`}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 transition-colors hover:text-brand-900"
        >
          اقرأ المقال
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden />
        </Link>
      </div>
    </InteractiveCard>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Home sections
// ═══════════════════════════════════════════════════════════════

/** "من نحن" teaser with the vision/mission cards from the mockup. */
export function AboutTeaser({
  title,
  text,
  image,
  imageAlt,
  imageHidden = false,
  vision,
  mission,
  visionTitle,
  missionTitle,
  ctaLabel,
  ctaHref = "/about",
}: {
  title: string;
  text: string;
  image?: string | null;
  imageAlt?: string;
  /** Set from the dashboard to remove the image and its placeholder. */
  imageHidden?: boolean;
  vision?: string | null;
  mission?: string | null;
  visionTitle?: string | null;
  missionTitle?: string | null;
  ctaLabel: string;
  ctaHref?: string;
}) {
  const cards = [
    { title: visionTitle ?? "رؤيتنا", text: vision, icon: "Send" as const },
    { title: missionTitle ?? "رسالتنا", text: mission, icon: "HeartHandshake" as const },
  ].filter((card) => Boolean(card.text));

  return (
    <section className="surface-purple py-20 sm:py-24">
      <div className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy (start = right) */}
          <div className="flex flex-col gap-7">
            {cards.length > 0 && (
              <Reveal className="grid gap-4 sm:grid-cols-2">
                {cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl border border-sand-200 bg-white/80 p-5 shadow-soft backdrop-blur"
                  >
                    <div className="flex items-start gap-3">
                      <IconChip icon={card.icon} tone="gold" size="sm" />
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-brand-900">
                          {card.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-3 text-[0.8125rem] leading-relaxed text-ink-600">
                          {card.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </Reveal>
            )}

            <Reveal delay={100}>
              <h2 className="text-3xl leading-[1.38] text-brand-900 sm:text-4xl">{title}</h2>
              <p className="mt-4 whitespace-pre-line text-[1.0625rem] leading-[2.05] text-ink-600">
                {text}
              </p>
              <ButtonLink
                href={ctaHref}
                variant="outline"
                size="lg"
                iconEnd="ChevronLeft"
                className="mt-7"
              >
                {ctaLabel}
              </ButtonLink>
            </Reveal>
          </div>

          {/* Image (end = left) — omitted entirely when hidden in the dashboard */}
          {!imageHidden && (
            <Reveal delay={140}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-brand-900/5">
                <Image
                  src={image || "/placeholders/about-center.svg"}
                  alt={imageAlt ?? ""}
                  fill
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/** "منهجية التعافي" — the five numbered steps. */
export function Methodology({
  title,
  text,
  steps,
  image,
  imageHidden = false,
}: {
  title: string;
  text: string;
  steps: Array<{ id: string; title: string; description: string; icon: string }>;
  image?: string | null;
  /** Set from the dashboard to remove the illustration. */
  imageHidden?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-brand-950 py-20 text-white sm:py-24">
      <div aria-hidden className="absolute inset-0 bg-dots opacity-20" />
      <div
        aria-hidden
        className="absolute -top-32 end-0 size-[30rem] rounded-full bg-brand-700/30 blur-3xl"
      />

      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {!imageHidden && (
            <Reveal>
              {/*
                A framed photograph rather than a bare rectangle.

                object-contain left visible bars on any image that was not
                exactly square, so the picture floated instead of sitting in the
                layout. object-cover fills the frame, and the corner radius,
                ring and shadow match the rest of the site so the photo reads as
                part of the design rather than pasted onto it.
              */}
              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                {/* Soft accent behind the frame, echoing the section glow. */}
                <div
                  aria-hidden
                  className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gold-400/10 blur-2xl"
                />

                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-white/12 sm:aspect-square">
                  <Image
                    src={image || "/placeholders/vision2030.svg"}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 42vw, 90vw"
                    className="object-cover"
                  />

                  {/* Keeps the frame edge crisp over bright photographs. */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/15"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1/4 rounded-b-[2rem] bg-gradient-to-t from-brand-950/45 to-transparent"
                  />
                </div>

                {/* Offset accent frame, a detail the hero and cards use. */}
                <div
                  aria-hidden
                  className="absolute -bottom-3 -end-3 -z-10 size-24 rounded-3xl border-2 border-gold-400/25"
                />
              </div>
            </Reveal>
          )}

          <div>
            <Reveal>
              <span className="eyebrow border-white/15 bg-white/8 text-gold-300">
                <SparkleDot />
                منهجية واضحة
              </span>
              <h2 className="mt-5 text-3xl leading-[1.38] text-white sm:text-4xl">{title}</h2>
              <p className="mt-4 text-[1.0625rem] leading-[2] text-brand-100">
                {text}
              </p>
            </Reveal>

            <ol className="mt-10 flex flex-col gap-7">
              {steps.map((step, index) => (
                <Reveal as="li" key={step.id} delay={index * 80}>
                  <div className="group flex gap-4 sm:gap-5">
                    {/*
                      self-stretch lets the connector grow to the full row
                      height. Without it the flex-1 line had nothing to fill
                      and rendered as a short stub under each badge.
                    */}
                    <span className="relative flex self-stretch flex-col items-center">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-500 font-extrabold text-brand-950 shadow-gold transition-transform group-hover:scale-105">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          aria-hidden
                          className="mt-2 w-px flex-1 bg-gradient-to-b from-gold-500/70 via-gold-500/25 to-transparent"
                        />
                      )}
                    </span>
                    <div className="pb-1 pt-1.5">
                      <h3 className="text-base font-extrabold text-white sm:text-lg">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-[0.9375rem] leading-[1.95] text-brand-200/90">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function SparkleDot() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
      <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z" />
    </svg>
  );
}

/** Icon strip: القيم / شريط الثقة. */
export function IconStrip({
  title,
  description,
  items,
  eyebrow,
  columns = "lg:grid-cols-5",
  id,
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  items: Array<{ id: string; title: string; description?: string | null; icon: string }>;
  columns?: string;
  id?: string;
}) {
  return (
    <section id={id} className="bg-sand-50 py-20 sm:py-24">
      <div className="container-page">
        {(title || eyebrow) && (
          <SectionHeading
            eyebrow={eyebrow}
            title={title ?? ""}
            description={description}
            className="mb-12"
          />
        )}

        <ul className={cn("grid gap-x-6 gap-y-10 sm:grid-cols-2", columns)}>
          {items.map((item, index) => (
            <Reveal as="li" key={item.id} delay={index * 60}>
              <div className="group flex flex-col items-center gap-3 text-center">
                <IconChip icon={item.icon} tone={chipToneFor(index)} size="lg" />
                <h3 className="text-base font-extrabold text-brand-900">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-[0.8125rem] leading-relaxed text-ink-500">
                    {item.description}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Full-width purple banner linking to the programs page. */
export function ProgramBanner({
  title,
  text,
  image,
  href = "/programs",
  ctaLabel = "تصفّح برامجنا",
}: {
  title: string;
  text: string;
  image?: string | null;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] panel-purple-deep px-7 py-12 shadow-lift sm:px-12 sm:py-16 lg:px-16">
            {image && (
              <>
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-brand-950/90 via-brand-900/70 to-brand-900/40" />
              </>
            )}
            <div
              aria-hidden
              className="absolute -bottom-24 -start-10 size-72 rounded-full bg-gold-500/15 blur-3xl"
            />

            <div className="relative max-w-2xl">
              <h2 className="text-3xl leading-[1.38] text-white sm:text-4xl">
                {title}
              </h2>
              <p className="mt-5 text-[1.0625rem] leading-[2] text-brand-100">
                {text}
              </p>
              <ButtonLink
                href={href}
                variant="white"
                size="lg"
                iconEnd="ChevronLeft"
                className="mt-8"
              >
                {ctaLabel}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export interface StatRow {
  id: string;
  label: string;
  value: string;
  prefix: string | null;
  suffix: string | null;
  icon: string | null;
  isHighlight: boolean;
}

/** Purple statistics band with animated counters. */
export function StatsBand({ stats }: { stats: StatRow[] }) {
  if (!stats.length) return null;
  const numbers = stats.map((s) => numericPart(s.value));

  return (
    <section className="relative overflow-hidden panel-purple py-16 sm:py-20">
      <div aria-hidden className="absolute inset-0 bg-dots opacity-15" />
      <div
        aria-hidden
        className="absolute -top-24 start-1/3 size-[26rem] rounded-full bg-gold-500/15 blur-3xl"
      />

      <div className="container-page relative">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon ? getIcon(stat.icon) : null;
            const number = numbers[index] ?? 0;
            const decoration = nonNumericPart(stat.value);

            return (
              <Reveal key={stat.id} delay={index * 90}>
                <div className="group flex flex-col items-center gap-3 rounded-2xl bg-white/6 px-5 py-8 text-center ring-1 ring-inset ring-white/10 backdrop-blur-sm transition-all duration-400 hover:-translate-y-1 hover:bg-white/10">
                  {Icon && (
                    <span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-300 ring-1 ring-inset ring-gold-400/30">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  )}

                  {stat.isHighlight ? (
                    <span className="text-xl font-extrabold text-gold-300">
                      {stat.value}
                    </span>
                  ) : (
                    <span className="text-4xl font-extrabold text-white sm:text-[2.75rem]">
                      <Counter
                        value={number}
                        prefix={stat.prefix ?? decoration}
                        suffix={stat.suffix ?? ""}
                      />
                    </span>
                  )}

                  <span className="text-[0.875rem] leading-relaxed text-brand-100">
                    {stat.label}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-brand-300">
          الأرقام أعلاه قابلة للتعديل بالكامل من لوحة التحكم.
        </p>
      </div>
    </section>
  );
}

/** Testimonials strip — anonymous by default. */
export function Testimonials({
  title,
  items,
}: {
  title?: string;
  items: Array<{
    id: string;
    quote: string;
    authorName: string | null;
    authorRole: string | null;
    rating: number;
    isAnonymous: boolean;
  }>;
}) {
  if (!items.length) return null;

  return (
    <section className="surface-purple py-20 sm:py-24">
      <div className="container-page">
        <SectionHeading title={title ?? "آراء المستفيدين"} className="mb-12" />

        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => (
            <Reveal as="li" key={item.id} delay={index * 80}>
              <figure className="flex h-full flex-col rounded-2xl border border-sand-200 bg-white p-6 shadow-soft">
                <Quote className="size-7 text-gold-300" aria-hidden />
                <blockquote className="mt-4 flex-1 text-[0.9375rem] leading-[1.95] text-ink-700">
                  {item.quote}
                </blockquote>

                <div
                  aria-label={`التقييم ${item.rating} من ٥`}
                  className="mt-5 flex gap-0.5"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      aria-hidden
                      className={cn(
                        "size-4",
                        i < item.rating
                          ? "fill-gold-400 text-gold-400"
                          : "text-sand-300",
                      )}
                    />
                  ))}
                </div>

                <figcaption className="mt-4 border-t border-sand-200 pt-4">
                  <p className="text-sm font-bold text-brand-900">
                    {item.isAnonymous ? "مستفيد" : item.authorName}
                  </p>
                  {item.authorRole && (
                    <p className="mt-0.5 text-xs text-ink-500">{item.authorRole}</p>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Closing call to action. */
export function CtaBanner({
  badge,
  title,
  text,
  image,
  imageAlt,
  imageHidden = false,
  primaryLabel = "احجز استشارة",
  primaryHref = "/book",
  secondaryLabel = "تواصل معنا",
  secondaryHref = "/contact",
}: {
  badge?: string | null;
  title: string;
  text: string;
  image?: string | null;
  imageAlt?: string | null;
  /** Set from the dashboard: the image column is removed entirely. */
  imageHidden?: boolean;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  const showImage = Boolean(image) && !imageHidden;

  return (
    <section className="pb-4 pt-4">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-sand-200">
            <div
              className={cn(
                "grid items-center gap-0",
                // Without the image the copy takes the full width rather than
                // leaving an empty column beside it.
                showImage ? "lg:grid-cols-[1.35fr_1fr]" : "",
              )}
            >
              <div className="p-7 sm:p-12 lg:p-14">
                {badge && <span className="eyebrow">{badge}</span>}
                <h2 className="mt-4 text-2xl leading-[1.38] text-brand-900 sm:text-3xl lg:text-4xl">
                  {title}
                </h2>
                <p className="mt-4 max-w-xl text-[1.0625rem] leading-[2] text-ink-600">
                  {text}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href={primaryHref} variant="gold" size="lg" icon="CalendarCheck">
                    {primaryLabel}
                  </ButtonLink>
                  <ButtonLink href={secondaryHref} variant="outline" size="lg">
                    {secondaryLabel}
                  </ButtonLink>
                </div>
              </div>

              {showImage && (
                <div className="relative min-h-[16rem] lg:min-h-full">
                  <Image
                    src={image as string}
                    alt={imageAlt ?? ""}
                    fill
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-l from-white via-white/25 to-transparent lg:from-white lg:via-white/20"
                  />
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
