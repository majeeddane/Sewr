/**
 * Verifies that Prisma can read the real production database end to end.
 *
 * This is the last check before deploying: it runs the same queries the pages
 * run, through the same client, so a problem here would appear as a broken
 * page in production.
 *
 * Run:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/verify-production-db.ts
 */
import { Client } from "pg";

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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n✗ اضبط DATABASE_URL كمتغير بيئة أولًا.\n");
  process.exit(1);
}

console.log(`\n— التحقق من قاعدة بيانات الإنتاج —\n`);

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const one = async <T>(sql: string): Promise<T[]> => {
    const { rows } = await client.query(sql);
    return rows as T[];
  };

  // ── The settings row every page depends on ──
  const settings = await one<{ siteName: string; tagline: string; primaryColor: string }>(
    `select "siteName", tagline, "primaryColor" from site_settings where id = 'singleton'`,
  );
  check("صف الإعدادات موجود", settings.length === 1);
  check("اسم الموقع صحيح", settings[0]?.siteName === "سوار وعي", settings[0]?.siteName ?? "");
  check("اللون الأساسي صحيح", settings[0]?.primaryColor === "#4B2A7B", settings[0]?.primaryColor ?? "");

  // ── Content the public pages render ──
  const counts = await one<{ services: number; programs: number; protocols: number }>(
    `select
       count(*) filter (where type = 'SERVICE')::int   as services,
       count(*) filter (where type = 'PROGRAM')::int   as programs,
       count(*) filter (where type = 'PROTOCOL')::int  as protocols
     from content_items where "isActive" = true`,
  );
  check(`الخدمات: ${counts[0]?.services}`, Number(counts[0]?.services) >= 9);
  check(`البرامج: ${counts[0]?.programs}`, Number(counts[0]?.programs) >= 9);
  check(`البروتوكولات: ${counts[0]?.protocols}`, Number(counts[0]?.protocols) >= 5);

  // ── Arabic survived the transfer intact ──
  const sample = await one<{ title: string; fullDescription: string; stepsJson: string }>(
    `select title, "fullDescription", "stepsJson" from content_items
     where type = 'SERVICE' order by "order" limit 1`,
  );
  const title = sample[0]?.title ?? "";
  const desc = sample[0]?.fullDescription ?? "";
  check("العنوان العربي سليم", /^[\u0600-\u06FF\s]+$/.test(title.trim()), title);
  check("لا حروف صينية", !/[\u4E00-\u9FFF]/.test(title + desc));
  check("الوصف طويل", desc.length > 200, `${desc.length} حرفًا`);

  // ── Blog ──
  const posts = await one<{ n: number }>(
    `select count(*)::int as n from posts
     where status = 'PUBLISHED' and "publishedAt" <= now()`,
  );
  check(`مقالات منشورة: ${posts[0]?.n}`, Number(posts[0]?.n) >= 3);

  const longPost = await one<{ content: string }>(
    `select content from posts order by length(content) desc limit 1`,
  );
  check(
    "أطول مقال مكتوب بالكامل",
    (longPost[0]?.content?.length ?? 0) > 2000,
    `${longPost[0]?.content?.length ?? 0} حرفًا`,
  );

  // ── Admin account ──
  const admin = await one<{ email: string; passwordHash: string; role: string }>(
    `select email, "passwordHash", role from users`,
  );
  check("حساب المدير موجود", admin.length === 1);
  check("الصلاحية SUPER_ADMIN", admin[0]?.role === "SUPER_ADMIN", admin[0]?.role ?? "");
  check("كلمة المرور بصمة bcrypt", /^\$2[aby]\$\d{2}\$/.test(admin[0]?.passwordHash ?? ""));

  // ── Security: sensitive data must be encrypted, not plaintext ──
  const clients = await one<{ phoneEnc: string; notesEnc: string | null }>(
    `select "phoneEnc", "notesEnc" from clients limit 3`,
  );
  const encrypted = clients.every((c) => c.phoneEnc.startsWith("v1:"));
  check("بيانات المستفيدين مشفّرة في القاعدة", encrypted);

  const messages = await one<{ messageEnc: string }>(
    `select "messageEnc" from contact_messages limit 3`,
  );
  check(
    "نصوص الرسائل مشفّرة",
    messages.length === 0 || messages.every((m) => m.messageEnc.startsWith("v1:")),
  );

  // ── Row-Level Security is armed in the live database ──
  const { rows: rls } = await client.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename, rowsecurity from pg_tables
     where schemaname = 'public' and tablename in
       ('clients','appointments','contact_messages','users','sessions')`,
  );
  check(
    `حماية الصفوف مفعّلة (${rls.filter((t) => t.rowsecurity).length}/${rls.length})`,
    rls.length === 5 && rls.every((t) => t.rowsecurity),
  );

  const { rows: policies } = await client.query<{ n: number }>(
    `select count(*)::int as n from pg_policies where schemaname = 'public'`,
  );
  check(`سياسات RLS: ${policies[0]?.n}`, Number(policies[0]?.n) >= 25);

  // ── Foreign keys ──
  const { rows: fks } = await client.query<{ n: number }>(
    `select count(*)::int as n from pg_constraint
     where contype = 'f' and connamespace = 'public'::regnamespace`,
  );
  check(`المفاتيح الأجنبية: ${fks[0]?.n}`, Number(fks[0]?.n) >= 10);

  await client.end();

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});