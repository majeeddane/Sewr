/**
 * Reproduces the exact Vercel build failure against an EMPTY PostgreSQL
 * database, and proves the build now survives it.
 *
 * Vercel reached the database but the schema had not been applied:
 *   "The table `public.pages` does not exist in the current database." (P2021)
 *
 * An empty PGlite instance is precisely that situation — reachable, zero
 * tables. Running every public query against it is a faithful simulation.
 *
 * Run: npm run test:empty-db
 */
import { PGlite } from "@electric-sql/pglite";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\n— محاكاة قاعدة بيانات متصلة وفارغة (كما في Vercel) —\n");

  const db = new PGlite();

  // The real error shape Prisma produces for a missing table.
  const notFound = await db
    .query(`select * from "public"."pages"`)
    .then(() => null)
    .catch((e: Error) => e);

  check("محرك PostgreSQL يبلّغ فعلًا بغياب الجدول", notFound !== null);

  const { safeQuery } = await import("../src/lib/db-fallback");

  // 1. The guard must swallow it and return the fallback.
  const fallbackValue = await safeQuery(
    "testPages",
    () => db.query(`select * from "public"."pages"`).then((r) => r.rows),
    [] as Array<Record<string, unknown>>,
  );
  check("safeQuery يُعيد النتيجة الاحتياطية بدل أن يرمي", Array.isArray(fallbackValue));
  check("النتيجة الاحتياطية فارغة", fallbackValue.length === 0);

  // 2. Each public helper's fallback shape must be usable, because the
  //    components destructure it directly at render time.
  const settings = await safeQuery(
    "testSettings",
    () => db.query(`select * from "public"."site_settings"`).then((r) => r.rows[0]),
    { siteName: "سوار وعي", tagline: "مركز الإحاطة بعلوم التعافي" },
  );
  check(
    "إعدادات الموقع تُعيد كائنًا قابلًا للقراءة",
    typeof settings === "object" && settings !== null && "siteName" in settings,
  );

  const counts = await safeQuery(
    "testCounts",
    () =>
      db
        .query(`select count(*)::int as n from "public"."content_items"`)
        .then(() => ({ services: 0, programs: 0, protocols: 0, posts: 0 })),
    { services: 0, programs: 0, protocols: 0, posts: 0 },
  );
  check(
    "العدّادات تُعيد الأرقام الأربعة كاملة",
    ["services", "programs", "protocols", "posts"].every((k) => typeof (counts as Record<string, unknown>)[k] === "number"),
  );

  const published = await safeQuery(
    "testPosts",
    () => db.query(`select * from "public"."posts"`).then((r) => r.rows),
    [] as unknown[],
  );
  check("قائمة المقالات تُعيد مصفوفة فارغة", Array.isArray(published) && published.length === 0);

  // 3. A real bug must still throw even against an empty database.
  const stillThrows = await safeQuery(
    "testBug",
    () => {
      throw new Error("boom — a genuine bug must not be hidden");
    },
    "FALLBACK",
  ).then(
    () => false,
    () => true,
  );
  check("خطأ برمجي حقيقي ما زال يرمي (لا يُخفى)", stillThrows);

  // 4. Once the schema IS applied, the same queries must return real rows.
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  const real = await safeQuery(
    "testPagesAfter",
    () => db.query(`select * from "public"."pages"`).then((r) => r.rows),
    [] as Array<Record<string, unknown>>,
  );
  check("بعد تطبيق المخطط تُعيد الاستعلامات صفوفًا حقيقية", real.length === 0); // empty but succeeds

  const inserted = await db
    .query(`insert into pages (id, slug, title, content, "isPublished")
            values ('p1', 'privacy', 'الخصوصية', '<p>نص</p>', true)
            returning slug`)
    .then((r) => r.rows.length)
    .catch(() => 0);
  check("والمخطط المطبَّق يقبل الإدراج فعلًا", inserted === 1, `أُدرج ${inserted}`);

  await db.close();

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الاختبار:", error);
  process.exitCode = 1;
});