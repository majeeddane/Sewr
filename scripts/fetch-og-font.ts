/**
 * Downloads the Arabic font used by the Open Graph image generator.
 *
 * Satori (which powers next/og) cannot fall back to a system font for Arabic,
 * and fetching it at build time from Google makes the build depend on the
 * network. So the TTF is vendored into public/fonts once, and the OG route
 * reads it from disk.
 *
 * Run: npx tsx scripts/fetch-og-font.ts
 * IBM Plex Sans Arabic is licensed under the SIL Open Font License 1.1.
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "fonts");
const TARGET = join(OUT_DIR, "IBMPlexSansArabic-Regular.ttf");

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400&display=swap";

async function main() {
  if (existsSync(TARGET)) {
    console.log("✓ الخط موجود مسبقًا:", TARGET);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // Without a browser User-Agent, Google serves the legacy TTF build — which
  // is exactly what Satori needs (it cannot read woff2).
  const css = await fetch(CSS_URL).then((r) => {
    if (!r.ok) throw new Error(`CSS request failed: ${r.status}`);
    return r.text();
  });

  const match = css.match(/url\((https:\/\/[^)]+\.(?:ttf|otf))\)/);
  if (!match?.[1]) throw new Error("لم يُعثر على رابط ملف TTF في CSS");

  const font = await fetch(match[1]).then((r) => {
    if (!r.ok) throw new Error(`Font request failed: ${r.status}`);
    return r.arrayBuffer();
  });

  writeFileSync(TARGET, Buffer.from(font));
  console.log(`✓ تم تنزيل الخط: ${TARGET} (${Math.round(font.byteLength / 1024)} KB)`);
}

main().catch((error) => {
  console.error("✗ فشل تنزيل الخط:", error.message);
  console.error(
    "  نزّل ملف TTF يدويًا إلى public/fonts/IBMPlexSansArabic-Regular.ttf",
  );
  process.exitCode = 1;
});
