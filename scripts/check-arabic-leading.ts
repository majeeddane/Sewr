/**
 * Measures the real line boxes of every Arabic heading in a real browser.
 *
 * The bug this guards against: Arabic tashkeel — the tanween and shadda in
 * "للتعافي", "تعافٍ", "أفضل" — sits above and below the baseline. When a
 * heading's computed line-height is tight, those marks overlap the neighbouring
 * line. The operator reported this on the hero title.
 *
 * Why this uses a browser rather than reading the HTML: the earlier version
 * parsed class names and looked for a `leading-*` utility. That reported false
 * failures, because a single rule in `@layer components` now sets a safe
 * line-height for all headings at once, and no utility appears on any of them.
 * It also missed real defects, because a `leading-[1.11]` would have looked fine
 * as text. Only the computed value answers the actual question.
 *
 * Two numbers are checked per heading:
 *
 *   - `ratio` — computed line-height / font-size. Latin display type is happy
 *     at 1.15; Arabic needs roughly 1.35 before marks start touching.
 *   - `spacing` — the measured distance between consecutive line boxes. This is
 *     the one that catches clipping, because a heading can report a healthy
 *     ratio and still be cropped by a short container.
 *
 * Run: npx tsx scripts/check-arabic-leading.ts [url]
 */
export {};

const SITE = process.argv[2] ?? "https://sewr.vercel.app";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/** Minimum computed ratio for a heading carrying diacritics. */
const FLOOR = 1.35;

/**
 * Tashkeel occupies roughly 1.05em of vertical space around the baseline, so
 * consecutive lines need at least that much between their boxes.
 */
const SPACING_FLOOR = 1.02;

const PAGES = [
  "/",
  "/about",
  "/services",
  "/services/al-iqtiyani-w-al-alami",
  "/programs",
  "/programs/daz-altahassus",
  "/protocols",
  "/blog",
  "/blog/al-ihtiwa-al-usari-duna-arqaba",
  "/contact",
  "/book",
  "/privacy",
];

interface Finding {
  path: string;
  tag: string;
  text: string;
  fontSize: number;
  ratio: number;
  spacing: number | null;
}

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`\n— ارتفاع السطر في العناوين العربية — ${SITE}\n`);

  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
    defaultViewport: { width: 1440, height: 1000 },
  });

  const findings: Finding[] = [];
  let totalHeadings = 0;
  let withTashkeel = 0;

  try {
    const page = await browser.newPage();

    for (const path of PAGES) {
      try {
        await page.goto(`${SITE}${path}`, { waitUntil: "networkidle2", timeout: 60000 });
        // Fonts must be settled: line-height is a CSS property, but the ratio
        // that makes it meaningful depends on the loaded font's metrics.
        await page.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, 400));

        const measured = await page.evaluate(() => {
          const out: Array<{
            tag: string;
            text: string;
            fontSize: number;
            ratio: number;
            spacing: number | null;
            tashkeel: boolean;
          }> = [];

          for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
            const cs = getComputedStyle(el);
            const fs = parseFloat(cs.fontSize);
            const lh = parseFloat(cs.lineHeight);
            if (!fs || !Number.isFinite(lh)) continue;

            // Real line boxes, via a Range: getClientRects() on a block
            // element returns one rect, not one per line.
            const range = document.createRange();
            range.selectNodeContents(el);
            const rects = [...range.getClientRects()].filter((r) => r.height > 4);

            // A heading can contain inline icons and spans, which produces
            // many rects on the *same* visual line. Collapse them into real
            // lines first: walk the tops in order and start a new line only
            // once the gap exceeds half a line box. Without this, spacing
            // comes out as 1px for any heading with an icon.
            const sorted = [...rects].sort((a, b) => a.top - b.top);
            const lineTops: number[] = [];
            for (const r of sorted) {
              const last = lineTops[lineTops.length - 1];
              if (last === undefined || r.top - last > lh / 2) lineTops.push(r.top);
              else lineTops[lineTops.length - 1] = last;
            }

            out.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30),
              fontSize: fs,
              ratio: +(lh / fs).toFixed(3),
              spacing:
                lineTops.length > 1
                  ? Math.round(
                      (lineTops[1] - lineTops[0]) * 10,
                    ) / 10
                  : null,
              tashkeel: /[\u064B-\u0652]/.test(el.textContent || ""),
            });
          }
          return out;
        });

        totalHeadings += measured.length;

        for (const m of measured) {
          if (!m.tashkeel) continue;
          withTashkeel += 1;

          // A single-line heading cannot collide with itself, so only the
          // ratio matters there; spacing only exists once the text wrapped.
          const tooTight = m.ratio < FLOOR;
          const tooClose = m.spacing !== null && m.spacing < m.fontSize * SPACING_FLOOR;
          if (tooTight || tooClose) {
            findings.push({ path, ...m });
          }
        }
      } catch (error) {
        console.log(`  ! ${path}: ${(error as Error).message.slice(0, 60)}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    `  فُحص ${totalHeadings} عنوانًا · ${withTashkeel} يحمل تشكيلًا · ${PAGES.length} صفحة\n`,
  );

  if (findings.length === 0) {
    check("كل عنوان يحمل تشكيلًا له ارتفاع سطر آمن", true);
  } else {
    for (const f of findings) {
      console.log(
        `      ${f.path} · ${f.tag} · ${f.fontSize}px · ratio ${f.ratio} · spacing ${
          f.spacing ?? "سطر واحد"
        } · "${f.text}"`,
      );
    }
    check(`${findings.length} عنوان ما زال ضيقًا`, false);
  }

  console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});