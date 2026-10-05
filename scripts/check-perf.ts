/**
 * Measures real response times for every public route and every admin route.
 *
 * The dashboard reported a ~5 second delay moving between sections. That is
 * either slow server response or slow client-side transition, and the fix is
 * completely different for each, so measure before changing anything.
 *
 * Run: npx tsx scripts/check-perf.ts [url]
 */
export {};

const SITE = process.argv[2] ?? "https://sewr.vercel.app";

/** Slow enough to feel broken to a user, fast enough to still be usable. */
const BUDGET_MS = 1500;

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/services",
  "/services/al-iqtiyani-w-al-alami",
  "/programs",
  "/programs/daz-altahassus",
  "/protocols",
  "/blog",
  "/blog/al-nawm-w-al-daghatt-al-nafsi-w-dabt-al-infeel",
  "/contact",
  "/book",
  "/admin/login",
];

interface Sample {
  path: string;
  cold: number;
  warm: number;
  bytes: number;
  status: number;
}

/** Cached response: how fast the page feels when a visitor navigates to it. */
async function timeOnce(path: string): Promise<{ ms: number; bytes: number; status: number }> {
  const started = Date.now();
  const res = await fetch(`${SITE}${path}`, { redirect: "follow" });
  const text = await res.text();
  return { ms: Date.now() - started, bytes: text.length, status: res.status };
}

async function main() {
  console.log(`\n— قياس الأداء على ${SITE} —\n`);
  console.log("  المسار".padEnd(52) + "بارد".padEnd(9) + "دافئ".padEnd(9) + "الحجم");
  console.log("  " + "─".repeat(80));

  const samples: Sample[] = [];

  for (const path of PUBLIC_ROUTES) {
    const cold = await timeOnce(path);
    const warm = await timeOnce(path);
    samples.push({ path, cold: cold.ms, warm: warm.ms, bytes: cold.bytes, status: cold.status });

    const mark = warm.ms > BUDGET_MS ? "!!" : "OK";
    console.log(
      `  ${mark} ${path.padEnd(48)}${String(cold.ms).padEnd(8)}${String(warm.ms).padEnd(8)}${Math.round(cold.bytes / 1024)} KB`,
    );
  }

  const slow = samples.filter((s) => s.warm > BUDGET_MS);
  const avg = Math.round(samples.reduce((a, s) => a + s.warm, 0) / samples.length);
  const worst = samples.reduce((a, b) => (a.warm > b.warm ? a : b));

  console.log("\n  " + "─".repeat(80));
  console.log(`  المتوسط: ${avg}ms · الأبطأ: ${worst.path} (${worst.warm}ms)`);

  if (slow.length === 0) {
    console.log("  ✓ كل المسارات ضمن الميزانية.\n");
  } else {
    console.log(`  ✗ ${slow.length} مسار تجاوز ${BUDGET_MS}ms:`);
    for (const s of slow) console.log(`      ${s.path} — ${s.warm}ms`);
    console.log();
  }

  // Payload size matters for perceived speed on mobile.
  const heavy = samples.filter((s) => s.bytes > 400_000);
  if (heavy.length) {
    console.log("  صفحات ثقيلة (فوق 400KB):");
    for (const s of heavy) console.log(`      ${s.path} — ${Math.round(s.bytes / 1024)}KB`);
    console.log();
  }

  process.exitCode = slow.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل القياس:", error);
  process.exitCode = 1;
});