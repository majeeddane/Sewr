/**
 * Verifies the live hero uses the full-bleed layout.
 *
 * A design change cannot be confirmed by a status code, and a browser window is
 * not always available for a screenshot, so this asserts on the deployed markup.
 *
 * The checks are scoped to the hero <section> only. A page-wide search would
 * produce false alarms, because the "about" section and the content cards
 * legitimately use aspect-ratio boxes and two-column grids of their own.
 *
 * Run: npx tsx scripts/check-hero-live.ts [url]
 */
export {};

const SITE = process.argv[2] ?? "https://sewr.vercel.app";

/** Everything between the first <section and its matching </section>. */
function heroOnly(html: string): string {
  const start = html.indexOf("<section");
  if (start === -1) return "";
  const end = html.indexOf("</section>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

const CHECKS: Array<[string, (hero: string) => boolean]> = [
  // The photograph fills the viewport and sits behind the copy.
  ["الصورة تملأ عرض الشاشة", (h) => h.includes('sizes="100vw"')],
  ["الصورة تغطي القسم بالكامل", (h) => h.includes('sizes="100vw"') && h.includes("object-cover")],
  ["الصورة absolute عبر خاصية fill", (h) => /position:\s*absolute/.test(h)],

  // Two scrims keep the headline legible.
  ["تدرّج أفقي على الجهة اليمنى", (h) => h.includes("bg-gradient-to-l")],
  ["تدرّج عمودي للقراءة", (h) => h.includes("from-brand-950/70")],

  // Layout and affordances.
  ["بطاقة الثقة متداخلة فوق الصورة", (h) => /-mt-1[24]\b/.test(h)],
  ["نص العنوان أبيض", (h) => h.includes("text-white")],
  ["زر فاتح للخلفيات الداكنة", (h) => h.includes("border-white/45")],
  ["النص محدود العرض للقراءة", (h) => h.includes("max-w-2xl")],

  // The old boxed layout must be gone from the hero.
  ["الصورة القديمة بصندوق اختفت", (h) => !h.includes("aspect-[4/3]")],
  ["لا تخطيط عمودين", (h) => !h.includes("lg:grid-cols-2")],
  ["لا حشو داخلي على القسم", (h) => !/class="[^"]*container-page[^"]*pt-10/.test(h)],
];

async function main() {
  console.log(`\n— فحص الواجهة الحيّة ${SITE} —\n`);

  const res = await fetch(`${SITE}/`, { redirect: "follow" });
  const html = await res.text();
  const hero = heroOnly(html);

  if (!hero) {
    console.error("  ✗ لم يُعثر على قسم الهيرو في الصفحة");
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  let bad = 0;

  for (const [label, test] of CHECKS) {
    const pass = test(hero);
    if (pass) ok += 1;
    else bad += 1;
    console.log(`  ${pass ? "OK" : "--"}  ${label}`);
  }

  console.log(`\n  نجح ${ok} · فشل ${bad}\n`);
  process.exitCode = bad > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});