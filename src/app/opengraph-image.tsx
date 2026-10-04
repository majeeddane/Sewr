import { ImageResponse } from "next/og";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const alt = "سوار وعي — مركز الإحاطة بعلوم التعافي";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share card.
 *
 * Rendered on demand with Satori, so it always reflects the current brand
 * colours and needs no binary asset. Satori cannot fall back to a system font
 * for Arabic, so we hand it the site's own typeface — vendored into
 * public/fonts by `npx tsx scripts/fetch-og-font.ts` so the build never needs
 * network access. If the font is missing we fall back to a purely geometric
 * card instead of failing the build.
 */
function loadFont(): ArrayBuffer | null {
  const path = join(
    process.cwd(),
    "public",
    "fonts",
    "IBMPlexSansArabic-Regular.ttf",
  );
  if (!existsSync(path)) return null;
  try {
    // Copy into a standalone ArrayBuffer — Satori rejects a Node Buffer view.
    const buffer = readFileSync(path);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

const FONT = "IBM Plex Sans Arabic";

export default async function OpengraphImage() {
  const primary = process.env.NEXT_PUBLIC_BRAND_PRIMARY || "#4B2A7B";
  const accent = process.env.NEXT_PUBLIC_BRAND_ACCENT || "#D9A441";
  const font = loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, #2A1447 0%, ${primary} 55%, #6B3FA0 100%)`,
          padding: "64px",
          fontFamily: font ? FONT : "sans-serif",
        }}
      >
        {/* Soft accent glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -160,
            width: 640,
            height: 640,
            borderRadius: 999,
            background: `radial-gradient(circle, ${accent}44 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              border: `7px solid ${accent}`,
              background: "rgba(255,255,255,0.06)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: "#FFFFFF" }}>
              سوار وعي
            </div>
            <div style={{ fontSize: 24, color: "#D9C8EF", letterSpacing: 3 }}>
              Sewr Waie
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.32,
              maxWidth: 980,
            }}
          >
            وعي يقود للتعافي.. وتعافٍ يصنع حياة أفضل
          </div>
          <div style={{ fontSize: 30, color: "#E8D9F5", maxWidth: 940 }}>
            مركز الإحاطة بعلوم التعافي — رعاية نفسية وعلمية متخصصة
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${accent}55`,
            paddingTop: 24,
          }}
        >
          <div style={{ fontSize: 23, color: "#D9C8EF" }}>
            الاستشارة الأولى مجانية للتقييم
          </div>
          <div style={{ fontSize: 23, color: accent, fontWeight: 700 }}>
            سرّية تامة · خصوصية كاملة
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(font
        ? {
            fonts: [
              {
                name: FONT,
                data: font,
                weight: 400 as const,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    },
  );
}
