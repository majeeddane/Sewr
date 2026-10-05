import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The "سوار وعي / Sewr Waie" mark: a tree of recovery inside a golden ring.
 *
 * Drawn as inline SVG so the dashboard can replace the logo file with an upload
 * (`logoPath`) and fall back to this vector when no file has been chosen.
 */
export function LogoMark({
  size = 44,
  className,
  ringOnly = false,
}: {
  size?: number;
  className?: string;
  ringOnly?: boolean;
}) {
  const uid = React.useId().replace(/[:]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="شعار سوار وعي"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${uid}-ring`} x1="20" y1="180" x2="180" y2="20">
          <stop offset="0%" stopColor="#F2C46A" />
          <stop offset="45%" stopColor="#D9A441" />
          <stop offset="100%" stopColor="#B98529" />
        </linearGradient>
        <linearGradient id={`${uid}-trunk`} x1="100" y1="60" x2="100" y2="178">
          <stop offset="0%" stopColor="#7D4FBB" />
          <stop offset="55%" stopColor="#5B3189" />
          <stop offset="100%" stopColor="#3A1F60" />
        </linearGradient>
        <linearGradient id={`${uid}-leaf`} x1="40" y1="50" x2="160" y2="130">
          <stop offset="0%" stopColor="#A8C46A" />
          <stop offset="60%" stopColor="#7BA33F" />
          <stop offset="100%" stopColor="#5E8530" />
        </linearGradient>
        <clipPath id={`${uid}-inner`}>
          <circle cx="100" cy="100" r="82" />
        </clipPath>
      </defs>

      {/* Golden ring with a deliberate opening at the top-right */}
      <circle
        cx="100"
        cy="100"
        r="92"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="530 48"
        transform="rotate(-38 100 100)"
      />
      <circle
        cx="100"
        cy="100"
        r="92"
        stroke={`url(#${uid}-ring)`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
        strokeDasharray="530 48"
        transform="rotate(-38 100 100)"
      />

      <g clipPath={`url(#${uid}-inner)`}>
        {/* Trunk and roots */}
        <path
          d="M92 178c0-30 3-52 8-70 3-11-6-14-12-22-5-7-4-14 2-14 7 0 11 6 12 13 1-14 5-25 8-25s7 11 8 25c1-7 5-13 12-13 6 0 7 7 2 14-6 8-15 11-12 22 5 18 8 40 8 70z"
          fill={`url(#${uid}-trunk)`}
        />
        {/* Roots */}
        <path
          d="M100 172c-6 4-14 6-24 5 6-3 10-6 12-9-5 1-11 1-17-1 8-1 14-3 18-6m11 11c6 4 14 6 24 5-6-3-10-6-12-9 5 1 11 1 17-1-8-1-14-3-18-6"
          stroke="#3A1F60"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Branch structure */}
        <g stroke="#5B3189" strokeWidth="4.5" strokeLinecap="round" fill="none">
          <path d="M100 116c-14-4-24-14-30-26" />
          <path d="M100 116c14-4 24-14 30-26" />
          <path d="M100 104c-9-8-14-19-15-30" />
          <path d="M100 104c9-8 14-19 15-30" />
          <path d="M100 92c0-10-1-19-4-27" />
        </g>

        {/* Leaves */}
        <g fill={`url(#${uid}-leaf)`}>
          <ellipse cx="60" cy="80" rx="11" ry="6" transform="rotate(-32 60 80)" />
          <ellipse cx="52" cy="92" rx="9" ry="5.5" transform="rotate(-18 52 92)" />
          <ellipse cx="72" cy="70" rx="10" ry="6" transform="rotate(-52 72 70)" />
          <ellipse cx="140" cy="80" rx="11" ry="6" transform="rotate(32 140 80)" />
          <ellipse cx="148" cy="92" rx="9" ry="5.5" transform="rotate(18 148 92)" />
          <ellipse cx="128" cy="70" rx="10" ry="6" transform="rotate(52 128 70)" />
          <ellipse cx="84" cy="64" rx="9" ry="5.5" transform="rotate(-70 84 64)" />
          <ellipse cx="116" cy="64" rx="9" ry="5.5" transform="rotate(70 116 64)" />
          <ellipse cx="92" cy="52" rx="9" ry="5.5" transform="rotate(-84 92 52)" />
          <ellipse cx="108" cy="52" rx="9" ry="5.5" transform="rotate(84 108 52)" />
          <ellipse cx="100" cy="42" rx="8" ry="6" />
          <ellipse cx="78" cy="86" rx="8" ry="5" transform="rotate(-40 78 86)" />
          <ellipse cx="122" cy="86" rx="8" ry="5" transform="rotate(40 122 86)" />
        </g>

        {/* Hope — the small star */}
        <g fill="#D9A441">
          <path d="M150 44l3.6 9.4 9.4 3.6-9.4 3.6-3.6 9.4-3.6-9.4-9.4-3.6 9.4-3.6z" />
          <circle cx="150" cy="68" r="2.6" />
        </g>
      </g>

      {!ringOnly && <circle cx="100" cy="100" r="82" stroke="#E7DAC6" strokeWidth="1.5" fill="none" />}
    </svg>
  );
}

/** Mark + Arabic/Latin wordmark, exactly as in the design mockup. */
export function Logo({
  size = 44,
  showWordmark = true,
  variant = "light",
  logoPath,
  siteName,
  siteNameEn,
  logoIncludesName = false,
  className,
  markClassName,
}: {
  size?: number;
  showWordmark?: boolean;
  /** "light" = for white backgrounds, "dark" = for the purple footer. */
  variant?: "light" | "dark";
  /** Uploaded logo from the dashboard; falls back to the built-in mark. */
  logoPath?: string | null;
  /** Written name, taken from the database so renaming works without a deploy. */
  siteName?: string | null;
  siteNameEn?: string | null;
  /**
   * Set when the uploaded file is a full lockup (mark + written name). The
   * image is then shown on its own, larger, because repeating the name beside
   * it would duplicate it.
   */
  logoIncludesName?: boolean;
  className?: string;
  markClassName?: string;
}) {
  const arabicName = siteName?.trim() || "سوار وعي";
  const latinName = siteNameEn?.trim() || "Sewr Waie";

  // A lockup image carries its own name, so it gets the full header height
  // and no separate wordmark.
  if (logoPath && logoIncludesName) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoPath}
        alt={arabicName}
        className={cn(
          "max-h-12 w-auto object-contain",
          variant === "dark" ? "brightness-0 invert" : "",
          className,
        )}
      />
    );
  }

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoPath}
          alt={arabicName}
          width={size}
          height={size}
          className={cn("shrink-0 object-contain", markClassName)}
          style={{ width: size, height: size }}
        />
      ) : (
        <LogoMark size={size} className={markClassName} />
      )}

      {showWordmark && (
        <span className="flex flex-col items-start leading-none">
          <span
            className={cn(
              "text-xl font-extrabold tracking-tight",
              variant === "dark" ? "text-white" : "text-brand-900",
            )}
            style={{
              background:
                variant === "dark"
                  ? "linear-gradient(to left, #ffffff, #E8D9F5)"
                  : "linear-gradient(to left, #7BA33F, #4B2A7B)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {arabicName}
          </span>
          <span
            dir="ltr"
            className={cn(
              "mt-1 text-[0.8125rem] font-semibold tracking-wide",
              variant === "dark" ? "text-brand-200" : "text-ink-500",
            )}
          >
            {latinName}
          </span>
        </span>
      )}
    </span>
  );
}
