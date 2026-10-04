"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";

/**
 * Share controls.
 *
 * Uses the native Web Share sheet when the device supports it (which is the
 * common case on mobile in Saudi Arabia), and falls back to copying the link.
 */
export function ShareButtons({
  title,
  url,
}: {
  title: string;
  /** Site-relative path; the absolute URL is built on the client. */
  url: string;
}) {
  const [copied, setCopied] = React.useState(false);

  // Whether the device supports the native share sheet, read during render so
  // the first paint is already correct (SSR snapshot is `false`).
  const canShare = React.useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "share" in navigator,
    () => false,
  );

  const absolute = () =>
    typeof window === "undefined"
      ? url
      : `${window.location.origin}${url}`;

  const share = async () => {
    const link = absolute();
    if (canShare) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch {
        // User dismissed the sheet — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-brand-300">مشاركة:</span>
      <button
        type="button"
        onClick={share}
        aria-label="مشاركة المقال"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-bold text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-300" aria-hidden />
            تم نسخ الرابط
          </>
        ) : (
          <>
            <Share2 className="size-3.5" aria-hidden />
            مشاركة
          </>
        )}
      </button>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(absolute());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            /* ignore */
          }
        }}
        aria-label="نسخ رابط المقال"
        className="grid size-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
      >
        <Link2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
