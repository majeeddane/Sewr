"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, X, Phone } from "lucide-react";
import { useScrolledPast } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/**
 * Floating WhatsApp button with an expandable quick-action menu.
 * Appears after a short scroll so it never covers the hero call to action.
 */
export function WhatsAppFab({
  number,
  message,
  phone,
}: {
  /** Digits only, e.g. 9665XXXXXXXX */
  number?: string | null;
  /** Pre-filled Arabic message. */
  message?: string | null;
  /** Fallback: shows a call button when WhatsApp is not configured. */
  phone?: string | null;
}) {
  const visible = useScrolledPast(420);
  const [expanded, setExpanded] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!expanded) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const hasWhatsApp = Boolean(number);
  const hasPhone = Boolean(phone);
  if (!hasWhatsApp && !hasPhone) return null;

  const waHref = hasWhatsApp
    ? `https://wa.me/${number}?text=${encodeURIComponent(
        message || "السلام عليكم، أرغب في الاستفسار عن خدمات مركز سوار وعي.",
      )}`
    : null;

  return (
    <div
      ref={ref}
      className={cn(
        "fixed bottom-5 end-5 z-40 flex flex-col items-end gap-3 transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      {/* Quick actions */}
      {expanded && (
        <div className="flex flex-col items-end gap-2.5">
          {hasPhone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2.5 rounded-full bg-white py-2.5 ps-4 pe-5 text-sm font-bold text-brand-800 shadow-lift ring-1 ring-sand-200 transition-transform hover:scale-[1.02]"
            >
              <Phone className="size-4 text-brand-700" aria-hidden />
              اتصل بنا
            </a>
          )}
          <Link
            href="/book"
            className="flex items-center gap-2.5 rounded-full bg-white py-2.5 ps-4 pe-5 text-sm font-bold text-brand-800 shadow-lift ring-1 ring-sand-200 transition-transform hover:scale-[1.02]"
          >
            <span className="text-gold-500" aria-hidden>
              ✦
            </span>
            احجز استشارة
          </Link>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {hasWhatsApp && !expanded && (
          <span className="hidden rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-800 opacity-0 shadow-soft transition-opacity duration-300 sm:block lg:opacity-100">
            تواصل معنا عبر واتساب
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            if (expanded) {
              setExpanded(false);
            } else if (waHref) {
              window.open(waHref, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = `tel:${phone}`;
            }
          }}
          aria-label={hasWhatsApp ? "تواصل معنا عبر واتساب" : "اتصل بالمركز"}
          aria-expanded={expanded}
          className={cn(
            "relative grid size-14 place-items-center rounded-full text-white shadow-lift transition-all duration-300 hover:scale-105 active:scale-95",
            hasWhatsApp ? "bg-[#25D366]" : "bg-brand-800",
          )}
        >
          {expanded ? (
            <X className="size-6" aria-hidden />
          ) : (
            <MessageCircle className="size-6" aria-hidden />
          )}
          {hasWhatsApp && !expanded && (
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40"
              style={{ animationDuration: "2.6s" }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
