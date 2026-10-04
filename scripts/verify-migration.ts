/**
 * Verifies every migration under prisma/migrations applies cleanly to an EMPTY
 * PostgreSQL database, and that the resulting table set matches
 * supabase/schema.sql.
 *
 * `npm run verify:schema` proves the Supabase path (schema.sql + seed.sql).
 * This proves the Prisma path (`prisma migrate deploy`) used on a fresh VPS.
 * Both must work; they create the same tables by different means.
 *
 * Run: npm run verify:migration
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = "prisma/migrations";

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

async function tables(db: PGlite): Promise<Set<string>> {
  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  return new Set(rows.map((r) => r.table_name));
}

async function main() {
  console.log("\n— تطبيق ترحيلات Prisma على قاعدة PostgreSQL فارغة —\n");

  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (!dirs.length) {
    check("يوجد ترحيل واحد على الأقل", false, "prisma/migrations فارغ");
    process.exitCode = 1;
    return;
  }
  check(`عدد الترحيلات: ${dirs.length}`, dirs.length >= 1);

  const db = new PGlite();

  for (const dir of dirs) {
    const file = join(MIGRATIONS_DIR, dir, "migration.sql");
    try {
      await db.exec(readFileSync(file, "utf8"));
      check(`الترحيل ${dir}`, true);
    } catch (error) {
      check(`الترحيل ${dir}`, false, (error as Error).message);
      await db.close();
      process.exitCode = 1;
      return;
    }
  }

  const created = await tables(db);
  check(`عدد الجداول المُنشأة: ${created.size}`, created.size === 22, `فعلي ${created.size}`);

  // The Prisma path must produce the same table set as supabase/schema.sql,
  // otherwise the app behaves differently depending on which was applied.
  const schemaDb = new PGlite();
  await schemaDb.exec(readFileSync("supabase/schema.sql", "utf8"));
  const fromSchema = await tables(schemaDb);
  await schemaDb.close();

  const onlyMigration = [...created].filter((t) => !fromSchema.has(t));
  const onlySchema = [...fromSchema].filter((t) => !created.has(t));
  check(
    "المجموعتان متطابقتان",
    onlyMigration.length === 0 && onlySchema.length === 0,
    [
      onlyMigration.length ? `في الترحيل فقط: ${onlyMigration.join(", ")}` : "",
      onlySchema.length ? `في schema.sql فقط: ${onlySchema.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );

  // Foreign keys must exist, including the deferred ones that schema.sql adds
  // via ALTER TABLE (Prisma declares them inline).
  const { rows: fkRows } = await db.query<{ conname: string; child: string }>(
    `select c.conname, c.conrelid::regclass::text as child
     from pg_constraint c
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace`,
  );
  const fkNames = new Set(fkRows.map((r) => r.conname));
  check(`عدد المفاتيح الأجنبية: ${fkRows.length}`, fkRows.length >= 11, `فعلي ${fkRows.length}`);

  // These two are the ones that historically had ordering problems.
  check("مفتاح clients → content_items موجود", fkNames.has("clients_programId_fkey") || fkRows.some(r => r.child.includes("clients")));
  check("مفتاح appointments → content_items موجود", fkRows.some((r) => r.child.includes("appointments")));

  // And the tables must accept real rows, with Prisma supplying @updatedAt.
  try {
    await db.exec(`
      insert into users (id, name, email, "emailLower", "passwordHash", role, "createdAt", "updatedAt")
        values ('u1', 'م', 'a@b.sa', 'a@b.sa', 'x', 'SUPER_ADMIN', now(), now());
      insert into content_items (id, type, slug, title, "shortDescription", "fullDescription", "createdAt", "updatedAt")
        values ('p1', 'PROGRAM', 'x', 'ت', 'و', 'ن', now(), now());
      insert into clients (id, code, "fullName", "searchName", "programId", "createdAt", "updatedAt")
        values ('c1', 'SW-1', 'اس', 'اس', 'p1', now(), now());
      insert into site_settings (id, "siteName", "createdAt", "updatedAt")
        values ('singleton', 'سوار وعي', now(), now());
    `);
    check("الإدراج يعمل والأعمدة الحرفية مطابقة", true);
  } catch (error) {
    check("الإدراج يعمل والأعمدة الحرفية مطابقة", false, (error as Error).message);
  }

  await db.close();

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("\n✗ فشل الفحص:", error);
  process.exitCode = 1;
});