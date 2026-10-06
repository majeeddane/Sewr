import * as React from "react";
import Link from "next/link";
import { createElement } from "react";
import { cn } from "@/lib/utils";
import { getIcon, type LucideIcon } from "@/lib/icons";

/**
 * Renders a resolved icon.
 *
 * Uses `createElement` rather than `<Icon />` on purpose: the icon component is
 * looked up at runtime from a name, and the React lint rules treat
 * `<Component />` with a freshly-derived binding as "creating a component
 * during render". `createElement` is the correct escape hatch here.
 */
function glyph(icon: LucideIcon | null, className: string) {
  if (!icon) return null;
  return createElement(icon, { className, "aria-hidden": true });
}

// ── Button ────────────────────────────────────────────────────

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 disabled:opacity-55 disabled:pointer-events-none select-none whitespace-nowrap";

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-800 text-white shadow-[0_10px_24px_-12px_rgba(75,42,123,0.7)] hover:bg-brand-900 hover:shadow-[0_14px_30px_-12px_rgba(75,42,123,0.8)] active:scale-[0.98]",
  gold: "bg-gold-500 text-brand-950 shadow-[0_10px_24px_-12px_rgba(217,164,65,0.85)] hover:bg-gold-400 hover:shadow-[0_14px_30px_-12px_rgba(217,164,65,0.95)] active:scale-[0.98]",
  outline:
    "border-2 border-brand-200 bg-white/70 text-brand-800 backdrop-blur hover:border-brand-400 hover:bg-white active:scale-[0.98]",
  outlineGold:
    "border-2 border-gold-300 bg-white/70 text-gold-700 backdrop-blur hover:border-gold-500 hover:bg-white active:scale-[0.98]",
  ghost: "text-brand-800 hover:bg-brand-50 active:scale-[0.98]",
  soft: "bg-brand-50 text-brand-800 hover:bg-brand-100 active:scale-[0.98]",
  white: "bg-white text-brand-800 shadow-soft hover:bg-sand-50 active:scale-[0.98]",
  /** For dark backgrounds such as the full-bleed hero. */
  outlineLight:
    "border-2 border-white/45 bg-white/10 text-white backdrop-blur-sm hover:border-white/80 hover:bg-white/20 active:scale-[0.98]",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 active:scale-[0.98]",
  whatsapp:
    "bg-[#25D366] text-white hover:bg-[#1eb855] active:scale-[0.98] shadow-[0_10px_24px_-14px_rgba(37,211,102,0.9)]",
} as const;

const BUTTON_SIZES = {
  sm: "h-9 px-4 text-[0.8125rem]",
  md: "h-11 px-6 text-[0.9375rem]",
  lg: "h-[3.25rem] px-8 text-base",
  xl: "h-14 px-9 text-lg",
  icon: "size-11 p-0",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | string | null;
  iconEnd?: LucideIcon | string | null;
  loading?: boolean;
}

function resolveIcon(icon: ButtonProps["icon"]): LucideIcon | null {
  if (!icon) return null;
  return typeof icon === "string" ? getIcon(icon) : icon;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      icon,
      iconEnd,
      loading,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    const Icon = resolveIcon(icon);
    const IconEnd = resolveIcon(iconEnd);
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          BUTTON_BASE,
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          glyph(Icon, "size-[1.1em] shrink-0")
        )}
        {children}
        {!loading && glyph(IconEnd, "size-[1.1em] shrink-0")}
      </button>
    );
  },
);

/** Same visual language as Button, but renders an anchor. */
export interface ButtonLinkProps
  extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | string | null;
  iconEnd?: LucideIcon | string | null;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  children,
  ...props
}: ButtonLinkProps) {
  const Icon = resolveIcon(icon);
  const IconEnd = resolveIcon(iconEnd);
  return (
    <Link
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {glyph(Icon, "size-[1.1em] shrink-0")}
      {children}
      {glyph(IconEnd, "size-[1.1em] shrink-0")}
    </Link>
  );
}

// ── Card ──────────────────────────────────────────────────────

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-sand-200 bg-white shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

/** Card that lifts on hover — used across every card grid. */
export function InteractiveCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-sand-200 bg-white shadow-soft transition-all duration-400 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

// ── Badge ─────────────────────────────────────────────────────

const BADGE_TONES = {
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  gold: "bg-gold-50 text-gold-700 ring-gold-200",
  sand: "bg-sand-100 text-ink-700 ring-sand-300",
  success: "bg-success-50 text-success-700 ring-success-100",
  warn: "bg-warn-50 text-warn-700 ring-warn-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  info: "bg-info-50 text-info-700 ring-info-100",
  outline: "bg-white text-ink-600 ring-sand-300",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "brand",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

// ── Icon chip ─────────────────────────────────────────────────

const CHIP_TONES = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  gold: "bg-gold-50 text-gold-700 ring-gold-200",
  sage: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function IconChip({
  icon,
  tone = "brand",
  size = "md",
  className,
}: {
  icon: LucideIcon | string | null | undefined;
  tone?: ChipTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "lg"
      ? "size-16 rounded-2xl"
      : size === "sm"
        ? "size-9 rounded-lg"
        : "size-12 rounded-xl";
  const glyphClass =
    size === "lg" ? "size-7" : size === "sm" ? "size-4" : "size-5";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 ring-inset transition-transform duration-300 group-hover:scale-105",
        CHIP_TONES[tone],
        dims,
        className,
      )}
    >
      {glyph(getIcon(typeof icon === "string" ? icon : null), glyphClass)}
    </span>
  );
}

/** Cycles through the chip tones so a grid looks lively without randomness. */
export function chipToneFor(index: number): ChipTone {
  const tones: ChipTone[] = ["brand", "gold", "sage", "sky", "rose", "amber"];
  return tones[index % tones.length];
}

// ── Section heading ───────────────────────────────────────────

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string | null;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "start";
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center"
          ? "items-center text-center"
          : "items-start text-start",
        action && "sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3",
          align === "center" ? "items-center" : "items-start",
          action && "sm:max-w-2xl",
        )}
      >
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <Tag className="text-3xl leading-[1.38] text-brand-900 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.4]">
          {title}
        </Tag>
        {description && (
          <p className="max-w-2xl text-base leading-[1.95] text-ink-600 sm:text-[1.0625rem]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Decorative divider ────────────────────────────────────────

export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex items-center gap-3", className)}
    >
      <span className="h-px flex-1 rule-gold" />
      <svg viewBox="0 0 24 24" className="size-4 text-gold-500" fill="currentColor">
        <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z" />
      </svg>
      <span className="h-px flex-1 rule-gold" />
    </div>
  );
}

// ── Stat chip (small inline number) ───────────────────────────

export function StatPill({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: LucideIcon | string | null;
}) {
  const Icon = getIcon(typeof icon === "string" ? icon : null);
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/85 px-5 py-4 text-center shadow-soft backdrop-blur">
      <span className="flex items-center gap-1.5 text-xl font-extrabold text-brand-800">
        {glyph(Icon, "size-4 text-gold-500")}
        {value}
      </span>
      <span className="text-[0.8125rem] font-medium text-ink-500">{label}</span>
    </div>
  );
}
