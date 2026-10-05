import Image from "next/image";
import { ButtonLink } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { getIcon } from "@/lib/icons";

export interface TrustItem {
  title: string;
  description: string | null | undefined;
  icon: string;
}

/**
 * Hero with a full-bleed background photograph, plus the floating trust bar.
 *
 * The image spans the entire viewport width and the copy sits on top of it,
 * instead of the photograph being a card in one column. Two things make that
 * readable rather than decorative:
 *
 *  1. A directional scrim. The site is RTL, so the copy sits on the right; the
 *     gradient is therefore strongest on the right and fades toward the left,
 *     so the photo still reads in the space the text does not occupy.
 *  2. A vertical scrim as well, which keeps the headline legible over bright
 *     skies and stops the bottom edge from fighting the trust card.
 *
 * Both gradients also serve as the fallback background when no photo has been
 * uploaded, so the section never looks unfinished.
 */
export function Hero({
  badge,
  title,
  description,
  image,
  imageAlt,
  trustItems,
}: {
  badge?: string | null;
  title: string;
  description?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  trustItems: TrustItem[];
}) {
  return (
    <section className="relative">
      {/* ── Full-bleed background ─────────────────────── */}
      <div className="relative isolate overflow-hidden bg-brand-950">
        {image ? (
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-950"
          />
        )}

        {/* Directional scrim — strongest under the RTL copy on the right. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-l from-brand-950/95 via-brand-950/75 to-brand-950/30"
        />
        {/* Vertical scrim — keeps the headline legible and softens the base. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-brand-950/45"
        />
        <div aria-hidden className="absolute inset-0 bg-grid-soft opacity-25" />
        <div
          aria-hidden
          className="absolute -top-32 end-[-15%] size-[34rem] rounded-full bg-brand-500/25 blur-3xl"
        />

        {/* ── Copy ─────────────────────────────────── */}
        <div className="container-page relative py-20 sm:py-24 lg:py-32">
          <div className="max-w-2xl">
            {badge && (
              <Reveal>
                <span className="eyebrow mb-6 border-white/25 bg-white/10 text-gold-200 backdrop-blur-sm">
                  {badge}
                </span>
              </Reveal>
            )}

            <Reveal delay={80}>
              <h1 className="text-[2.15rem] font-extrabold leading-[1.28] text-white drop-shadow-sm sm:text-5xl sm:leading-[1.22] lg:text-[3.5rem] lg:leading-[1.18]">
                {title}
              </h1>
            </Reveal>

            {description && (
              <Reveal delay={160}>
                <p className="mt-6 max-w-xl text-[1.0625rem] leading-[2.05] text-sand-100/95 sm:text-lg">
                  {description}
                </p>
              </Reveal>
            )}

            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <ButtonLink
                  href="/book"
                  variant="gold"
                  size="lg"
                  icon="CalendarCheck"
                  iconEnd="ChevronLeft"
                >
                  احجز استشارة
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  variant="outlineLight"
                  size="lg"
                  icon="MessageCircle"
                >
                  تواصل معنا
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-7 flex items-center gap-2 text-[0.8125rem] text-sand-200/80">
                <span aria-hidden>🔒</span>
                طلبك يبقى سرّيًا ولا يُشارك مع أي جهة دون إذنك.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── Trust bar, overlapping the photo ──────────── */}
      {trustItems.length > 0 && (
        <div className="container-page relative z-10 -mt-12 sm:-mt-14">
          <Reveal delay={120}>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-3xl border border-sand-200 bg-white/95 px-5 py-7 shadow-lift backdrop-blur-md sm:grid-cols-3 sm:px-8 lg:grid-cols-6 lg:py-8">
              {trustItems.map((item, index) => {
                const Icon = getIcon(item.icon);
                return (
                  <li
                    key={`${item.title}-${index}`}
                    className="group flex flex-col items-center gap-2.5 text-center"
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:bg-brand-100">
                      <Icon className="size-5.5" aria-hidden />
                    </span>
                    <span className="text-[0.8125rem] font-bold text-ink-800">
                      {item.title}
                    </span>
                    {item.description && (
                      <span className="text-[0.6875rem] leading-snug text-ink-400">
                        {item.description}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      )}

      {/* Spacer so the overlapping trust bar does not collide with the next
          section on small screens. */}
      <div aria-hidden className="h-12 bg-sand-50 sm:h-16" />
    </section>
  );
}