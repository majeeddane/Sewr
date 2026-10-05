/**
 * Captures screenshots of the admin dashboard for the client preview deck.
 *
 * The dashboard is behind an httpOnly session cookie, so plain headless Chrome
 * cannot reach it: there is no way to inject the cookie without a real login.
 * Puppeteer performs the actual sign-in, which also proves the documented
 * credentials work before anything is shown to a client.
 *
 * Writes to an ASCII path: headless Chrome silently fails to save when the
 * working directory contains Arabic characters.
 *
 * Usage:  npx tsx scripts/capture-admin-preview.ts
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "https://sewr.vercel.app";
const OUT = process.argv[3] ?? join(tmpdir(), "sewr-preview");

const CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const EMAIL = process.env.PREVIEW_EMAIL ?? "admin@sewrwaie.sa";
const PASSWORD = process.env.PREVIEW_PASSWORD ?? "SewrWaie@2026";

const PAGES: Array<[string, string, number]> = [
  ["20-admin-overview", "/admin", 1100],
  ["21-admin-clients", "/admin/clients", 1100],
  ["22-admin-appointments", "/admin/appointments", 1100],
  ["23-admin-content", "/admin/content/SERVICE", 1150],
  ["24-admin-posts", "/admin/posts", 1100],
  ["25-admin-images", "/admin/images", 1300],
  ["26-admin-media", "/admin/media", 1000],
  ["27-admin-settings", "/admin/settings", 1300],
  ["28-admin-activity", "/admin/activity", 1000],
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--disable-gpu", "--hide-scrollbars", "--no-sandbox"],
    defaultViewport: { width: 1440, height: 1100 },
  });

  const page = await browser.newPage();

  console.log("\n— تسجيل الدخول لالتقاط لوحة التحكم —\n");

  // ── Sign in ──
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });

  await page.type('input[type="email"], input[name="email"]', EMAIL, { delay: 8 });
  await page.type('input[type="password"]', PASSWORD, { delay: 8 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  const landed = page.url();
  if (landed.includes("/login")) {
    console.error("  ✗ فشل تسجيل الدخول — تحقّق من البيانات");
    await browser.close();
    process.exitCode = 1;
    return;
  }
  console.log("  ✓ تم تسجيل الدخول");

  // ── Capture ──
  let ok = 0;
  const failed: string[] = [];

  for (const [name, path, height] of PAGES) {
    try {
      await page.setViewport({ width: 1440, height });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 60000 });

      // Dashboard sections are dynamic; wait out the loading skeleton.
      await page
        .waitForFunction(() => !document.body.innerText.includes("جارٍ تحميل القسم"), { timeout: 45000 })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));

      // Fire reveal-on-scroll animations so nothing is captured mid-fade.
      await page.evaluate(async () => {
        const step = 400;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await new Promise((r) => setTimeout(r, 700));

      await page.screenshot({ path: join(OUT, `${name}.png`) });
      console.log(`  ✓ ${name}`);
      ok += 1;
    } catch (error) {
      console.log(`  ✗ ${name} — ${(error as Error).message.slice(0, 60)}`);
      failed.push(name);
    }
  }

  await browser.close();

  console.log(`\n  نجح ${ok} · فشل ${failed.length}`);
  console.log(`  المجلد: ${OUT}\n`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل:", error);
  process.exitCode = 1;
});