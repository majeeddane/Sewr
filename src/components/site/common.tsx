import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Home } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

// ── Prose: renders sanitised admin-authored rich text ────────

export function Prose({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const clean = sanitizeHtml(html);
  if (!clean) return null;
  return (
    <div
      className={cn("prose-ar", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ── Breadcrumbs ──────────────────────────────────────────────

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
  tone = "light",
}: {
  items: Crumb[];
  className?: string;
  tone?: "light" | "dark";
}) {
  const base =
    tone === "dark"
      ? "text-brand-300"
      : "text-ink-500";
  const link = tone === "dark" ? "hover:text-gold-300" : "hover:text-brand-700";

  return (
    <nav aria-label="مسار التنقل" className={cn("text-[0.8125rem]", className)}>
      <ol className={cn("flex flex-wrap items-center gap-1.5", base)}>
        <li className="flex items-center gap-1.5">
          <Link href="/" className={cn("transition-colors", link)}>
            <Home className="size-3.5" aria-hidden />
            <span className="sr-only">الرئيسية</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className={cn("transition-colors", link)}>
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
                className={cn(
                  "font-bold",
                  tone === "dark" ? "text-white" : "text-brand-800",
                )}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ── Page hero banner for inner pages ─────────────────────────

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  crumbs,
  children,
  compact = false,
}: {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  image?: string | null;
  imageAlt?: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-brand-950",
        compact ? "py-14 sm:py-16" : "py-16 sm:py-20 lg:py-24",
      )}
    >
      {/* Background art */}
      {image ? (
        <>
          <Image
            src={image}
            alt={imageAlt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-brand-950 via-brand-950/85 to-brand-900/70" />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-dots opacity-[0.35]"
          />
          <div
            aria-hidden
            className="absolute -top-32 start-1/4 size-[34rem] rounded-full bg-brand-700/30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 end-0 size-[28rem] rounded-full bg-gold-500/12 blur-3xl"
          />
        </>
      )}

      <div className="container-page relative">
        {crumbs && <Breadcrumbs items={crumbs} tone="dark" className="mb-6" />}

        <div className="max-w-3xl">
          {eyebrow && (
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[0.8125rem] font-bold text-gold-300 ring-1 ring-inset ring-white/15">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mt-5 text-base leading-[2] text-brand-100 sm:text-lg">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

// ── Decorative media tile used where the owner has no photo ──

/**
 * When a content item has no image we still want the card to look designed
 * rather than broken: a brand gradient with the item's icon and a faint dot
 * grid stands in until a real photo is uploaded.
 */
export function MediaTile({
  image,
  alt,
  icon,
  className,
  ratio = "aspect-[4/3]",
  priority = false,
  sizes = "(min-width: 1024px) 40vw, 100vw",
  children,
}: {
  image?: string | null;
  alt?: string | null;
  icon?: React.ComponentType<{ className?: string }> | null;
  className?: string;
  ratio?: string;
  priority?: boolean;
  sizes?: string;
  children?: React.ReactNode;
}) {
  if (image) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl", ratio, className)}>
        <Image
          src={image}
          alt={alt ?? ""}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        {children}
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900",
        ratio,
        className,
      )}
    >
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="absolute -end-8 -top-8 size-40 rounded-full bg-gold-500/20 blur-2xl" />
      {icon && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-20 place-items-center rounded-3xl bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            <IconFallback icon={icon} />
          </span>
        </span>
      )}
      {children}
    </div>
  );
}

/** Renders a Lucide component at a fixed size. */
export function IconFallback({
  icon: Icon,
  className = "size-9 text-gold-300/90",
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return <Icon className={className} />;
}

// ── Empty state ──────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-6 py-14 text-center">
      <p className="text-lg font-bold text-brand-900">{title}</p>
      {description && (
        <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
