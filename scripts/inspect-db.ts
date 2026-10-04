/**
 * Connects to a PostgreSQL database and reports what is inside it.
 *
 * Used to confirm a DATABASE_URL works, and to check whether the schema has
 * been applied yet. Read-only by default: it never writes unless you pass
 * --apply-schema or --apply-seed.
 *
 * Run:
 *   npx tsx scripts/inspect-db.ts
 *   npx tsx scripts/inspect-db.ts --apply-schema
 *   npx tsx scripts/inspect-db.ts --apply-seed
 *
 * The URL comes from the DATABASE_URL environment variable, never from a
 * committed file, so no credential ends up in git.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const args = process.argv.slice(2);
const APPLY_SCHEMA = args.includes("--apply-schema");
const APPLY_SEED = args.includes("--apply-seed");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n✗ اضبط DATABASE_URL كمتغير بيئة أولًا.\n");
  process.exit(1);
}

// Never let a password reach the console or a log file.
const safe = url.replace(/:\/\/([^:]+):([^@]+)@/, (_m, user: string) => `://${user}:••••@`);
console.log(`\n— الاتصال بـ ${safe} —\n`);

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
  } catch (error) {
    console.error("✗ فشل الاتصال:", (error as Error).message);
    console.error(
      "\n  الأسباب المحتملة:\n" +
        "    · كلمة المرور غير صحيحة\n" +
        "    · مشروع Supabase متوقف (Paid plan)\n" +
        "    · الجدار الناري يمنع الاتصال من هذا الجهاز\n",
    );
    process.exitCode = 1;
    return;
  }

  const { rows: ver } = await client.query("select version() as v");
  console.log(`  ✓ متصل · ${String(ver[0]?.v ?? "").split(",")[0]}`);

  const { rows: tables } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  console.log(`  · الجداول الموجودة: ${tables.length}`);

  if (tables.length === 0 && !APPLY_SCHEMA && !APPLY_SEED) {
    console.log("\n  قاعدة البيانات فارغة — لم يُطبَّق المخطط بعد.\n");
    await client.end();
    return;
  }

  if (APPLY_SCHEMA) {
    console.log("\n  · تطبيق supabase/schema.sql …");
    await client.query(readFileSync("supabase/schema.sql", "utf8"));
    console.log("  ✓ تم تطبيق المخطط");
  }

  if (APPLY_SEED) {
    console.log("  · تطبيق supabase/seed.sql …");
    await client.query(readFileSync("supabase/seed.sql", "utf8"));
    console.log("  ✓ تم تطبيق البيانات");
  }

  const { rows: after } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );

  if (after.length) {
    console.log(`\n  الجداول (${after.length}):`);
    console.log("    " + after.map((t) => t.table_name).join(", "));
  }

  // Row counts for the tables that carry the site content.
  for (const table of ["content_items", "posts", "faqs", "pages", "users", "site_settings"]) {
    try {
      const { rows } = await client.query<{ n: number }>(
        `select count(*)::int as n from public."${table}"`,
      );
      console.log(`    ${table.padEnd(16)} ${rows[0]?.n ?? 0}`);
    } catch (error) {
      console.log(`    ${table.padEnd(16)} — ${(error as Error).message.slice(0, 60)}`);
    }
  }

  await client.end();
  console.log("");
}

main().catch(async (error) => {
  console.error("\n✗ خطأ:", error);
  process.exitCode = 1;
});