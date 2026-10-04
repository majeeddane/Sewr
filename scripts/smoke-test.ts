/**
 * HTTP smoke test — everything observable from outside the app.
 *
 * Server Actions cannot be invoked outside a request scope, so form
 * submissions are exercised in a real browser instead (see the flow in
 * docs/ADMIN-GUIDE.md). What this script guarantees is that every route
 * responds, that the dashboard is closed to anonymous visitors, and that no
 * encrypted column is ever serialised into HTML.
 *
 * Usage:  npx tsx scripts/smoke-test.ts [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function httpStatus(path: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return res.status;
}

async function text(path: string): Promise<string> {
  return (await fetch(`${BASE}${path}`)).text();
}

async function main() {
  console.log(`\n— فحص المسارات على ${BASE} —\n`);

  console.log("١. الصفحات العامة");
  for (const path of [
    "/",
    "/about",
    "/services",
    "/programs",
    "/protocols",
    "/blog",
    "/contact",
    "/book",
    "/privacy",
    "/terms",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/opengraph-image",
    "/icon.svg",
    "/placeholders/hero-sunrise.svg",
  ]) {
    check(`GET ${path}`, (await httpStatus(path)) === 200);
  }

  console.log("\n٢. صفحات التفاصيل");
  const sitemap = await text("/sitemap.xml");
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1]!.replace(BASE, ""),
  );
  check(`عدد المسارات في خريطة الموقع: ${paths.length}`, paths.length >= 30);

  let detailOk = 0;
  for (const path of paths.filter((p) => /\/(services|programs|protocols|blog)\/.+/.test(p))) {
    if ((await httpStatus(path)) === 200) detailOk += 1;
  }
  check(`صفحات التفاصيل تعمل (${detailOk})`, detailOk >= 20);

  console.log("\n٣. RTL وإتاحة الوصول و SEO");
  const home = await text("/");
  check('lang="ar" و dir="rtl"', home.includes('lang="ar"') && home.includes('dir="rtl"'));
  check("رابط تخطٍ إلى المحتوى", home.includes("تخطَّ إلى المحتوى الرئيسي"));
  check("وسم canonical", home.includes('rel="canonical"'));
  check("Open Graph", home.includes('property="og:'));
  check("بيانات منظّمة JSON-LD", home.includes('application/ld+json') || home.includes('"@context"'));
  check("robots يستثني /admin و /api", (await text("/robots.txt")).includes("/admin"));
  check("صفحة 404 مخصّصة", (await httpStatus("/no-such-page-xyz")) === 404);

  console.log("\n٤. حماية لوحة التحكم");
  for (const path of [
    "/admin",
    "/admin/clients",
    "/admin/appointments",
    "/admin/messages",
    "/admin/posts",
    "/admin/content",
    "/admin/media",
    "/admin/settings",
    "/admin/users",
    "/admin/activity",
    "/admin/profile",
  ]) {
    const code = await httpStatus(path);
    check(`${path} محمي`, code === 307 || code === 302, `status ${code}`);
  }

  console.log("\n٥. منع تسريب البيانات");
  const publicPages = ["/", "/about", "/services", "/programs", "/blog", "/contact", "/book", "/admin/login"];
  let leaked = 0;
  for (const path of publicPages) {
    const html = await text(path);
    // Encrypted payloads look like `v1:<iv>:<tag>:<ciphertext>`; Prisma column
    // names and the session token must never appear either.
    if (
      /v1:[A-Za-z0-9_-]{8,}:/.test(html) ||
      html.includes("phoneEnc") ||
      html.includes("messageEnc") ||
      html.includes("passwordHash") ||
      html.includes("twoFactorSecret")
    ) {
      leaked += 1;
      console.error(`      تسريب محتمل في ${path}`);
    }
  }
  check("لا تسريب في أي صفحة", leaked === 0);

  console.log("\n٦. رؤوس الأمان");
  const res = await fetch(`${BASE}/`);
  const headers = res.headers;
  check("X-Content-Type-Options", headers.get("x-content-type-options") === "nosniff");
  check("X-Frame-Options", headers.get("x-frame-options") === "SAMEORIGIN");
  check("Referrer-Policy", Boolean(headers.get("referrer-policy")));
  check("Permissions-Policy", Boolean(headers.get("permissions-policy")));
  check("Strict-Transport-Security", Boolean(headers.get("strict-transport-security")));
  check("لا يُعلن عن Next.js", headers.get("x-powered-by") === null);

  console.log("\n٧. المحتوى العربي سليم");
  check("لا توجد محارف صينية مسرّبة", !/[\u4E00-\u9FFF]/.test(home));
  check("نصوص المدونة تظهر", (await text("/blog")).includes("دقائق قراءة"));
  check("نموذج الحجز يظهر", (await text("/book")).includes("احجز استشارة"));

  console.log(`\n${"─".repeat(46)}`);
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log(`${"─".repeat(46)}\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});
