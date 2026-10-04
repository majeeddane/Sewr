"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered reveal. Uses IntersectionObserver (no animation library), so
 * it costs almost nothing on the main thread.
 *
 * With JavaScript disabled the CSS keeps the content hidden; we therefore also
 * add a `no-js`-safe fallback by marking the element visible after hydration
 * regardless.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
  amount = 0.15,
}: {
  children: React.ReactNode;
  /** milliseconds */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "span";
  amount?: number;
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect prefers-reduced-motion: show everything immediately.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.setAttribute("data-reveal", "visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: amount, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      data-reveal="hidden"
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * `useSyncExternalStore` based subscriptions for values that live outside
 * React (scroll position, OS colour scheme). Deriving them during render instead
 * of syncing them in an effect keeps them correct on first paint and avoids the
 * cascading re-render the effect approach causes.
 */
const noopSubscribe = () => () => {};

// ── Scroll position ───────────────────────────────────────────

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange, { passive: true });
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/** `true` once the page has scrolled past `offset` pixels. */
export function useScrolledPast(offset = 12): boolean {
  return React.useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > offset,
    () => false,
  );
}

// ── Reduced motion ───────────────────────────────────────────

function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeMotionPreference,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// ── Dark mode (admin only) ────────────────────────────────────

const THEME_EVENT = "sw-theme-change";

function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useDarkMode(): boolean {
  return React.useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

/** Applies and remembers the admin colour scheme. */
export function useThemeToggle() {
  const dark = useDarkMode();

  const toggle = React.useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("sw-admin-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  /** Runs the stored preference once, on the client, after hydration. */
  const hydrate = React.useCallback(() => {
    const stored = window.localStorage.getItem("sw-admin-theme");
    const prefersDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  return { dark, toggle, hydrate };
}

/** Counts up to `value` once it scrolls into view. */
export function Counter({
  value,
  duration = 1600,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [animated, setAnimated] = React.useState(0);
  const done = React.useRef(false);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || done.current) return;
        done.current = true;
        observer.disconnect();

        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // easeOutExpo — fast start, gentle settle.
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setAnimated(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration, reduced]);

  const display = reduced ? value : animated;
  const formatted = new Intl.NumberFormat("en-US").format(display);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export { noopSubscribe };
