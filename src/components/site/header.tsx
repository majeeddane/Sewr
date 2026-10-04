"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { useScrolledPast } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "من نحن" },
  { href: "/services", label: "خدماتنا" },
  { href: "/programs", label: "برامجنا" },
  { href: "/blog", label: "المدونة" },
  { href: "/contact", label: "تواصل معنا" },
];

/**
 * Sticky site header.
 *
 * RTL-first: the logo sits on the right, navigation flows right-to-left and the
 * calls to action are pinned to the left edge. The bar gains a blur + shadow
 * once the page scrolls so content stays legible underneath it.
 */
export function SiteHeader({
  logoPath,
  phone,
}: {
  logoPath?: string | null;
  phone?: string | null;
}) {
  const pathname = usePathname();
  const scrolled = useScrolledPast(12);
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // The mobile panel is closed by its own links (see `close`), rather than by
  // syncing state from `pathname` in an effect — that would cause a second
  // render pass on every navigation.
  const close = React.useCallback(() => setOpen(false), []);

  // Lock body scroll + support Escape while the panel is open.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── Announcement bar ─────────────────────────────── */}
      <div className="relative z-50 bg-brand-950 text-brand-100">
        <div className="container-page flex h-9 items-center justify-center gap-2 text-[0.8125rem]">
          <Sparkles className="size-3.5 text-gold-400" aria-hidden />
          <p className="truncate text-center">
            استشارة أولى مجانية للتقييم — اتصل بنا على{" "}
            {phone ? (
              <a href={`tel:${phone}`} className="font-bold text-gold-300 hover:underline" dir="ltr">
                {phone}
              </a>
            ) : (
              <span className="font-bold text-gold-300">الرقم المعلن في الموقع</span>
            )}
          </p>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-400",
          scrolled
            ? "border-b border-sand-200 bg-sand-50/85 shadow-soft backdrop-blur-xl"
            : "border-b border-transparent bg-sand-50/60 backdrop-blur-sm",
        )}
      >
        <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
          {/* Logo (start edge in RTL) */}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl py-1 transition-opacity hover:opacity-85"
            aria-label="سوار وعي — الصفحة الرئيسية"
          >
            <Logo logoPath={logoPath} size={40} />
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="التنقل الرئيسي" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-bold transition-colors",
                        active
                          ? "text-brand-800"
                          : "text-ink-600 hover:text-brand-800",
                      )}
                    >
                      {item.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-4 -bottom-0.5 h-[3px] rounded-full bg-gradient-to-l from-gold-400 to-gold-500"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <ButtonLink href="/book" variant="gold" size="sm" icon="CalendarCheck">
              احجز استشارة
            </ButtonLink>
            <ButtonLink href="/contact" variant="primary" size="sm" icon="MessageCircle">
              تواصل معنا
            </ButtonLink>
          </div>

          {/* Mobile trigger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            className="grid size-11 place-items-center rounded-xl border border-sand-200 bg-white/80 text-brand-800 transition-colors hover:bg-brand-50 lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile panel */}
        <div
          id="mobile-nav"
          ref={panelRef}
          hidden={!open}
          className="border-t border-sand-200 bg-sand-50/98 backdrop-blur-xl lg:hidden"
        >
          <nav aria-label="التنقل عبر الجوال" className="container-page py-5">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-12 items-center rounded-xl px-4 text-base font-bold transition-colors",
                        active
                          ? "bg-brand-800 text-white"
                          : "text-ink-700 hover:bg-brand-50",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 grid gap-2.5">
              <ButtonLink href="/book" onClick={close} variant="gold" size="md" icon="CalendarCheck" className="w-full">
                احجز استشارة
              </ButtonLink>
              <ButtonLink href="/contact" onClick={close} variant="primary" size="md" icon="MessageCircle" className="w-full">
                تواصل معنا
              </ButtonLink>
              {phone && (
                <Button
                  variant="outline"
                  size="md"
                  icon="Phone"
                  className="w-full"
                  onClick={() => {
                    close();
                    window.location.href = `tel:${phone}`;
                  }}
                >
                  <span dir="ltr">{phone}</span>
                </Button>
              )}
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
