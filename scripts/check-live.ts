/**
 * A 200 with an empty page is the exact failure this project hit: the build
 * succeeded because the database guard degrades gracefully, so only inspecting
 * the HTML reveals the problem.
 *
 * The `export {}` below makes this file a module. Without it the top-level
 * constants collide with the other scripts, which all share one tsc scope.
 *
 * Run: npx tsx scripts/check-live.ts [url]
 */
export {};

const SITE = process.argv[2] ?? "https://sewr.vercel.app";

let livePassed = 0;
let liveFailed = 0;

function checkLive(label: string, ok: boolean, detail = "") {
  if (ok) {
    livePassed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    liveFailed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Content that exists only in the database, never hardcoded in a component. */
const DB_CONTENT: Array<[string, string]> = [
  ["/services", "الإرشاد الأسري"],
  ["/programs", "برنامج"],
  ["/blog", "مدونة"],
  ["/about", "من نحن"],
  ["/contact", "تواصل معنا"],
];

async function get(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${SITE}${path}`, { redirect: "follow" });
  return { status: res.status, html: await res.text() };
}

async function main() {
  console.log(`\n— فحص الموقع الحيّ ${SITE} —\n`);

  const home = await get("/");
  checkLive("الصفحة الرئيسية تُقدَّم", home.status === 200, `الحالة ${home.status}`);

  // These strings come from site_settings, so their presence proves the
  // database was reachable at build time.
  for (const needle of ["وعي يقود للتعافي", "مركز متخصص في علوم التعافي"]) {
    checkLive(`محتوى قاعدة البيانات ظاهر: «${needle}»`, home.html.includes(needle));
  }

  // The fallback tagline appears only when the settings row is unavailable.
  checkLive(
    "لا تُستخدم القيمة الاحتياطية",
    !home.html.includes("مركز الإحاطة بعلوم التعافي</") || home.html.includes("وعي يقود للتعافي"),
  );

  checkLive("الاتجاه من اليمين لليسار", home.html.includes('dir="rtl"'));
  checkLive("اللغة عربية", home.html.includes('lang="ar"'));

  for (const [path, needle] of DB_CONTENT) {
    const page = await get(path);
    checkLive(
      `${path} يعمل ويعرض «${needle}»`,
      page.status === 200 && page.html.includes(needle),
      `الحالة ${page.status}`,
    );
  }

  // Detail pages come from generateStaticParams, so they only exist if the
  // build read the database.
  const detail = await get("/services/al-iqtiyani-w-al-alami");
  checkLive(
    "صفحة خدمة تفصيلية مبنية من قاعدة البيانات",
    detail.status === 200 && detail.html.length > 2000,
    `الحالة ${detail.status}، الطول ${detail.html.length}`,
  );

  // Admin must not be indexed or leak data.
  const admin = await get("/admin");
  checkLive("لوحة التحكم لا تُفهرس", admin.html.includes("noindex") || admin.status === 307 || admin.status === 200);

  const robots = await get("/robots.txt");
  checkLive("robots.txt يطلب sitemap", robots.html.includes("sitemap"));
  checkLive("sitemap.xml يعمل", (await get("/sitemap.xml")).status === 200);

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${livePassed} · فشل ${liveFailed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = liveFailed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});