/**
 * Verifies the brand logo is identical everywhere it appears.
 *
 * The bug this guards against: the public site read `logoPath` from the
 * settings row, while the dashboard sidebar rendered `<Logo size={34} />` with
 * no path at all. An operator could upload a new logo, see it change on the
 * site, and see the dashboard keep the built-in mark — which reads as the save
 * having failed.
 *
 * Run: npx tsx scripts/check-logo-consistency.ts
 */
export {};

const SITE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = process.env.PREVIEW_EMAIL ?? "admin@sewrwaie.sa";
const PASSWORD = process.env.PREVIEW_PASSWORD ?? "SewrWaie@2026";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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

/** Pulls the uploaded logo path out of the rendered header. */
async function siteLogo(): Promise<string> {
  const res = await fetch(`${SITE}/`, { redirect: "follow" });
  const html = await res.text();
  const match = html.match(/\/storage\/v1\/object\/public\/media\/[^"\\\s]+/);
  return match?.[0] ?? "";
}

async function main() {
  console.log(`\n— توحّد الشعار في كل المواضع —\n`);

  const logo = await siteLogo();
  check("الموقع العام يعرض شعارًا مرفوعًا", logo.length > 0, logo || "لم يُعثر على مسار");

  if (!logo) {
    console.log("\n  لا يوجد شعار مرفوع — لا شيء للمقارنة.\n");
    process.exitCode = 1;
    return;
  }
  console.log(`  ${logo}\n`);

  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
    defaultViewport: { width: 1440, height: 1000 },
  });
  const page = await browser.newPage();

  // Sign in.
  await page.goto(`${SITE}/admin/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.type('input[type="email"], input[name="email"]', EMAIL, { delay: 8 });
  await page.type('input[type="password"]', PASSWORD, { delay: 8 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  check("تسجيل الدخول ينجح", !page.url().includes("/login"), page.url());

  // Dashboard sidebar.
  await page.goto(`${SITE}/admin`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const sidebar = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    const img = aside?.querySelector('img[src*="/storage/"]');
    return { found: !!img, src: img?.getAttribute("src") ?? "" };
  });
  check("شعار الشريط الجانبي = شعار الموقع", sidebar.src.endsWith(logo), sidebar.src || "لا يوجد");

  // Settings preview strip.
  await page.goto(`${SITE}/admin/settings`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  const preview = await page.evaluate(() => {
    const section = document.querySelector('section[aria-label*="معاينة"]');
    const img = section?.querySelector('img[src*="/storage/"]');
    return { found: !!img, src: img?.getAttribute("src") ?? "" };
  });
  check("شعار معاينة الإعدادات = شعار الموقع", preview.src.endsWith(logo), preview.src || "لا يوجد");

  // Images page card.
  await page.goto(`${SITE}/admin/images`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  const images = await page.evaluate(() => {
    const img = document.querySelector('img[src*="/storage/"]');
    return { found: !!img, src: img?.getAttribute("src") ?? "" };
  });
  check("صورة الشعار في صفحة الصور", images.src.endsWith(logo), images.src || "لا يوجد");

  await browser.close();

  console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});