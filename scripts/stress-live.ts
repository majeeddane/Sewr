/**
 * Hammers the live site with concurrent requests to prove the database pool
 * holds up.
 *
 * The failure this guards against was intermittent: Supabase's session pooler
 * allows 15 connections, Vercel runs each request in its own function, so the
 * 16th concurrent request failed with EMAXCONNSESSION while every page still
 * looked healthy in a serial test.
 *
 * Run: npx tsx scripts/stress-live.ts [url] [rounds]
 */
const BASE = process.argv[2] ?? "https://sewr.vercel.app";
const ROUNDS = Number(process.argv[3] ?? 3);

// Pages that each hit the database on a cold request (dynamic routes).
const PATHS = [
  "/",
  "/services",
  "/services/al-iqtiyani-w-al-alami",
  "/programs",
  "/programs/daz-altahassus",
  "/blog",
  "/blog/al-nawm-w-al-daghatt-al-nafsi-w-dabt-al-infeel",
  "/protocols",
  "/about",
  "/contact",
  "/book",
];

let stressOk = 0;
let stressBad = 0;

function record(status: number, ok: boolean) {
  if (ok) stressOk += 1;
  else stressBad += 1;
  return status;
}

async function main() {
  console.log(`\n— ضغط ${ROUNDS} جولة × ${PATHS.length} صفحة متزامنة —\n`);

  for (let round = 1; round <= ROUNDS; round += 1) {
    const started = Date.now();
    const results = await Promise.all(
      PATHS.map(async (path) => {
        try {
          const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
          const ok = res.status === 200;
          record(res.status, ok);
          return ok ? null : `${path} → ${res.status}`;
        } catch (error) {
          record(0, false);
          return `${path} → ${(error as Error).message.slice(0, 50)}`;
        }
      }),
    );
    const failures = results.filter(Boolean);
    const ms = Date.now() - started;
    const mark = failures.length === 0 ? "OK " : "!! ";
    console.log(`  ${mark}جولة ${round}: ${PATHS.length - failures.length}/${PATHS.length} في ${ms}ms`);
    for (const failure of failures) console.log(`      ${failure}`);
  }

  console.log(`\n  الإجمالي: نجح ${stressOk} · فشل ${stressBad}`);
  console.log(
    stressBad === 0
      ? "\n✓ لا نفاد في الاتصالات تحت الضغط.\n"
      : "\n✗ فشل بعض الطلبات — راجع سجل Vercel بحثًا عن EMAXCONNSESSION.\n",
  );

  process.exitCode = stressBad > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗", error);
  process.exitCode = 1;
});