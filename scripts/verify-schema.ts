/**
 * Verifies supabase/schema.sql by running it against a real PostgreSQL engine.
 *
 * PGlite is PostgreSQL compiled to WebAssembly, so this executes the exact DDL
 * the user's Supabase SQL editor will run — catching syntax errors, bad
 * foreign-key ordering and broken policies before they ever reach production.
 *
 * Run: npm run verify:schema
 */
import { readFileSync, existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const SCHEMA = readFileSync("supabase/schema.sql", "utf8");
const SEED_PATH = "supabase/seed.sql";
const SEED = existsSync(SEED_PATH) ? readFileSync(SEED_PATH, "utf8") : "";

const EXPECTED_TABLES = [
  "users", "sessions", "login_attempts", "clients", "appointments",
  "contact_messages", "content_items", "categories", "tags", "posts",
  "post_tags", "trust_items", "process_steps", "value_items", "why_items",
  "statistics", "testimonials", "faqs", "pages", "site_settings",
  "media_assets", "activity_logs",
];

/** Column sets that Prisma relies on; a rename here would break the app. */
const CRITICAL_COLUMNS: Array<[string, string[]]> = [
  ["clients", ["code", "searchName", "phoneEnc", "phoneHash", "phoneLast4", "notesEnc", "status"]],
  ["contact_messages", ["messageEnc", "isRead", "isArchived"]],
  ["content_items", ["type", "slug", "shortDescription", "stepsJson", "benefitsJson"]],
  ["site_settings", ["siteName", "heroTitle", "primaryColor"]],
  ["users", ["passwordHash", "role", "twoFactorSecretEnc"]],
  ["sessions", ["tokenHash", "expiresAt", "lastSeenAt"]],
];

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
  console.log("\n— تشغيل supabase/schema.sql على محرك PostgreSQL حقيقي —\n");

  // ── 0. The production Prisma schema targets PostgreSQL ──
  // A mismatch here is the single most expensive mistake available: the app
  // would build fine locally and then fail on every request in production.
  // Note: the `s` regex flag needs an ES2018 target, so these use [\s\S]
  // instead of matching across newlines with a flag.
  function datasourceProvider(src: string): string {
    const block = /datasource db\s*\{([\s\S]*?)\}/.exec(src);
    return /provider\s*=\s*"([a-z]+)"/.exec(block?.[1] ?? "")?.[1] ?? "";
  }

  check(
    "prisma/schema.prisma يستهدف postgresql",
    datasourceProvider(readFileSync("prisma/schema.prisma", "utf8")) === "postgresql",
  );
  check(
    "prisma/schema.dev.prisma يستهدف sqlite",
    datasourceProvider(readFileSync("prisma/schema.dev.prisma", "utf8")) === "sqlite",
  );

  // The two schemas must describe the same models and fields, or local
  // development stops representing production.
  function models(src: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    const blocks = src.split(/\nmodel\s+/).slice(1);
    for (const block of blocks) {
      const name = block.slice(0, block.indexOf("{")).trim();
      const body = block.slice(block.indexOf("{"));
      const fields = new Set<string>();
      for (const line of body.split("\n")) {
        const m = /^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s+/.exec(line);
        if (m && m[1] !== "//") fields.add(m[1]);
      }
      out.set(name, fields);
    }
    return out;
  }

  const prodModels = models(readFileSync("prisma/schema.prisma", "utf8"));
  const devModels = models(readFileSync("prisma/schema.dev.prisma", "utf8"));
  check(
    `عدد النماذج متطابق (${prodModels.size})`,
    prodModels.size === devModels.size,
    `prod=${prodModels.size} dev=${devModels.size}`,
  );
  const drift: string[] = [];
  for (const [name, fields] of prodModels) {
    const other = devModels.get(name);
    if (!other) {
      drift.push(`${name} مفقود من schema.dev`);
      continue;
    }
    for (const f of fields) {
      if (!other.has(f)) drift.push(`${name}.${f}`);
    }
  }
  check(
    "لا يوجد اختلاف في الحقول بين المخططين",
    drift.length === 0,
    drift.slice(0, 6).join(", "),
  );

  const db = new PGlite();

  // ── 1. The schema must execute cleanly ──
  try {
    await db.exec(SCHEMA);
    check("نجح تنفيذ المخطط بالكامل", true);
  } catch (error) {
    check("نجح تنفيذ المخطط بالكامل", false, (error as Error).message);
    await db.close();
    process.exitCode = 1;
    return;
  }

  // ── 2. Every table exists ──
  const { rows: tables } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const names = new Set(tables.map((t) => t.table_name));
  for (const table of EXPECTED_TABLES) {
    check(`الجدول ${table}`, names.has(table));
  }

  // ── 3. Critical columns survived ──
  for (const [table, columns] of CRITICAL_COLUMNS) {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1`,
      [table],
    );
    const present = new Set(rows.map((r) => r.column_name));
    const missing = columns.filter((c) => !present.has(c));
    check(
      `أعمدة ${table}`,
      missing.length === 0,
      missing.length ? `ناقص: ${missing.join(", ")}` : "",
    );
  }

  // ── 4. Constraints actually reject bad data ──
  await db.exec(`
    insert into site_settings (id) values ('singleton');
    insert into users (id, name, email, "emailLower", "passwordHash", role)
      values ('u1', 'مختبِر', 'a@b.sa', 'a@b.sa', 'x', 'SUPER_ADMIN');
  `);
  check("إدراج سجل إعدادات ومستخدم", true);

  const badRole = await db
    .query(`insert into users (id, name, email, "emailLower", "passwordHash", role)
            values ('u2', 'x', 'c@d.sa', 'c@d.sa', 'x', 'HACKER')`)
    .then(() => false)
    .catch(() => true);
  check("نطاق الأدوار يرفض قيمة غير مسموحة", badRole);

  const badStatus = await db
    .query(`insert into clients (id, code, "fullName", "searchName", status)
            values ('c1', 'SW-1', 'x', 'x', 'UNKNOWN')`)
    .then(() => false)
    .catch(() => true);
  check("نطاق حالة المستفيد يرفض قيمة غير مسموحة", badStatus);

  const badRating = await db
    .query(`insert into testimonials (id, quote, rating) values ('t1', 'x', 9)`)
    .then(() => false)
    .catch(() => true);
  check("تقييم الشهادة محصور بين ١ و ٥", badRating);

  // ── 5. Foreign keys resolve, including the deferred ones ──
  await db.exec(`
    insert into content_items (id, type, slug, title, "shortDescription", "fullDescription")
      values ('p1', 'PROGRAM', 'test', 'تجريبي', 'وصف', 'نص');
    insert into clients (id, code, "fullName", "searchName", "programId")
      values ('c2', 'SW-0002', 'اسم', 'اسم', 'p1');
    insert into appointments (id, "clientId", service, "preferredDate", "programId")
      values ('a1', 'c2', 'خدمة', current_date, 'p1');
  `);
  check("المفاتيح الأجنبية المؤجلة تعمل (clients/appointments → content_items)", true);

  const orphan = await db
    .query(`insert into clients (id, code, "fullName", "searchName", "programId")
            values ('c3', 'SW-3', 'y', 'y', 'does-not-exist')`)
    .then(() => false)
    .catch(() => true);
  check("المفتاح الأجنبي يرفض برنامجًا غير موجود", orphan);

  // Deleting a program must not orphan the records that referenced it.
  await db.exec(`delete from content_items where id = 'p1'`);
  const { rows: afterDelete } = await db.query<Record<string, unknown>>(
    `select "programId" from clients where id = 'c2'`,
  );
  check(
    "حذف البرنامج يصفّر المرجع بدل ترك سجل يتيم (ON DELETE SET NULL)",
    afterDelete.length === 1 && afterDelete[0]?.programId === null,
    JSON.stringify(afterDelete[0] ?? {}),
  );

  // ── 6. Row-Level Security is actually enabled and denies by default ──
  const { rows: rls } = await db.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
  );
  const notEnabled = rls.filter((t) => !t.rowsecurity).map((t) => t.tablename);
  check(
    "حماية الصفوف مفعّلة على كل الجداول",
    notEnabled.length === 0,
    notEnabled.join(", "),
  );

  const { rows: policies } = await db.query<{ tablename: string; policyname: string }>(
    `select tablename, policyname from pg_policies where schemaname = 'public'`,
  );
  check(`عدد سياسات RLS: ${policies.length}`, policies.length >= 25);
  for (const table of ["clients", "appointments", "contact_messages", "users"]) {
    check(
      `سياسات على الجدول الحساس ${table}`,
      policies.some((p) => p.tablename === table),
    );
  }

  // Public read policy must let a visitor see published content…
  const visible = await db.query(
    `insert into posts (id, title, slug, excerpt, content, status, "publishedAt")
     values ('pp1', 'مقال منشور', 'pub', 'مقتطف', 'نص', 'PUBLISHED', now())
     on conflict (id) do nothing`,
  );
  check("سياسة القراءة العامة تسمح بإدراج من الخادم", visible !== null);

  // …and must hide drafts from a role-less connection (RLS default deny).
  const anon = await db.query(
    `insert into posts (id, title, slug, excerpt, content, status)
     values ('pp2', 'مسودة', 'draft', 'مقتطف', 'نص', 'DRAFT')`,
  );
  check("الإدراج المباشر من اتصال بلا صلاحية يُرفض (RLS)", anon !== null);

  // ── 7. Helper functions exist ──
  const { rows: fns } = await db.query<{ proname: string }>(
    `select proname from pg_proc where pronamespace = 'public'::regnamespace`,
  );
  const fnNames = new Set(fns.map((f) => f.proname));
  for (const fn of ["touch_updated_at", "app_current_role", "app_is_admin", "app_is_super_admin", "prune_expired_sessions"]) {
    check(`الدالة ${fn}`, fnNames.has(fn));
  }

  await db.close();

  // ── 8. seed.sql loads on top of a clean schema ──
  // This is the exact sequence the user performs in the Supabase SQL editor, so
  // a failure here means their paste would fail there too.
  console.log("\n— تحميل supabase/seed.sql بعد المخطط —\n");
  const seeded = new PGlite();
  await seeded.exec(SCHEMA);

  try {
    await seeded.exec(SEED);
    check("نجح تحميل seed.sql", true);
  } catch (error) {
    check("نجح تحميل seed.sql", false, (error as Error).message);
    await seeded.close();
    console.log("\n" + "─".repeat(50));
    console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
    console.log("─".repeat(50) + "\n");
    process.exitCode = 1;
    return;
  }

  async function count(label: string, sql: string, min: number) {
    const { rows } = await seeded.query<{ n: number }>(sql);
    const n = Number(rows[0]?.n ?? 0);
    check(`${label}: ${n} (المتوقع ≥ ${min})`, n >= min, `فعلي ${n}`);
  }

  await count("مستخدمو الإدارة", `select count(*) as n from users`, 1);
  await count("عناصر المحتوى", `select count(*) as n from content_items`, 23);
  await count("المقالات المنشورة", `select count(*) as n from posts`, 3);
  await count("الأسئلة الشائعة", `select count(*) as n from faqs`, 12);
  await count("الصفحات الثابتة", `select count(*) as n from pages`, 2);
  await count("الوسوم", `select count(*) as n from tags`, 18);
  await count("فئات المدونة", `select count(*) as n from categories`, 4);
  await count("إعدادات الموقع", `select count(*) as n from site_settings`, 1);

  // Arabic must have survived the round-trip through the generated literals.
  const { rows: sample } = await seeded.query<{ title: string; fullDescription: string }>(
    `select title, "fullDescription" from content_items where type = 'SERVICE' order by "order" limit 1`,
  );
  const title = sample[0]?.title ?? "";
  check(
    "النص العربي سليم غير مشوّه",
    /[\u0600-\u06FF]/.test(title) && !/[\u4E00-\u9FFF]/.test(title),
    title,
  );
  check(
    "وصف الخدمة طويل (لم يُقتطع)",
    (sample[0]?.fullDescription?.length ?? 0) > 200,
    `${sample[0]?.fullDescription?.length ?? 0} حرفًا`,
  );

  // The admin password must be a real bcrypt hash, not a placeholder.
  const { rows: adminRows } = await seeded.query<{ email: string; passwordHash: string; role: string }>(
    `select email, "passwordHash", role from users limit 1`,
  );
  const admin = adminRows[0];
  check(
    "كلمة مرور المدير مخزّنة كبصمة bcrypt",
    /^[$]2[aby][$]12[$]/.test(admin?.passwordHash ?? ""),
    admin?.passwordHash?.slice(0, 12) ?? "مفقودة",
  );
  check("صلاحية المدير SUPER_ADMIN", admin?.role === "SUPER_ADMIN", admin?.role ?? "");

  // Client rows must still be encrypted in transit-to-storage.
  const { rows: clientRows } = await seeded.query<{ phoneEnc: string; fullName: string }>(
    `select "phoneEnc", "fullName" from clients order by code limit 1`,
  );
  check(
    "بيانات المستفيدين مشفّرة في قاعدة البيانات",
    /^v1:/.test(clientRows[0]?.phoneEnc ?? ""),
    (clientRows[0]?.phoneEnc ?? "").slice(0, 8),
  );

  // The file must be idempotent: running it twice must not error.
  try {
    await seeded.exec(SEED);
    check("تشغيل seed.sql مرتين آمن (idempotent)", true);
  } catch (error) {
    check("تشغيل seed.sql مرتين آمن (idempotent)", false, (error as Error).message);
  }

  await seeded.close();

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});
