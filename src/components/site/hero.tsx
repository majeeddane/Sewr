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
 * Hero + floating trust bar.
 *
 * Layout follows the mockup: text on the start (right) edge, photography on
 * the end (left) edge, and the trust bar as a white card that overlaps both.
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
    <section className="relative overflow-hidden bg-sand-100">
      <div
        aria-hidden
        className="absolute inset-0 bg-grid-soft opacity-60"
      />
      <div
        aria-hidden
        className="absolute -top-24 end-[-10%] size-[36rem] rounded-full bg-brand-100/60 blur-3xl"
      />

      <div className="container-page relative pt-10 sm:pt-14 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* ── Copy ─────────────────────────────────── */}
          <div className="order-2 lg:order-1">
            {badge && (
              <Reveal>
                <span className="eyebrow mb-5">{badge}</span>
              </Reveal>
            )}

            <Reveal delay={80}>
              <h1 className="text-[2.1rem] leading-[1.28] text-brand-900 sm:text-5xl sm:leading-[1.22] lg:text-[3.4rem] lg:leading-[1.18]">
                {title}
              </h1>
            </Reveal>

            {description && (
              <Reveal delay={160}>
                <p className="mt-6 max-w-xl text-[1.0625rem] leading-[2.05] text-ink-600 sm:text-lg">
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
                  variant="primary"
                  size="lg"
                  icon="MessageCircle"
                >
                  تواصل معنا
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-6 flex items-center gap-2 text-[0.8125rem] text-ink-500">
                <span aria-hidden>🔒</span>
                طلبك يبقى سرّيًا ولا يُشارك مع أي جهة دون إذنك.
              </p>
            </Reveal>
          </div>

          {/* ── Image ────────────────────────────────── */}
          <div className="order-1 lg:order-2">
            <Reveal delay={120}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-brand-900/5 sm:aspect-[16/11] lg:aspect-[4/3]">
                {image ? (
                  <Image
                    src={image}
                    alt={imageAlt ?? ""}
                    fill
                    priority
                    sizes="(min-width: 1024px) 46vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-950" />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-brand-950/45 via-transparent to-transparent"
                />
                <div
                  aria-hidden
                  className="absolute -bottom-6 -start-6 size-32 rounded-full bg-gold-400/25 blur-2xl"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── Trust bar ────────────────────────────────── */}
      {trustItems.length > 0 && (
        <div className="container-page relative z-10">
          <Reveal delay={120}>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-3xl border border-sand-200 bg-white/92 px-5 py-7 shadow-lift backdrop-blur-md sm:grid-cols-3 sm:px-8 lg:grid-cols-6 lg:py-8">
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
      <div aria-hidden className="h-10 sm:h-14" />
    </section>
  );
}
