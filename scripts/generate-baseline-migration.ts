/**
 * Regenerates prisma/migrations/<timestamp>_baseline/migration.sql from
 * prisma/schema.prisma.
 *
 * Uses `prisma migrate diff` to produce the DDL, then prepends the explanatory
 * header. Everything is handled in Node because piping UTF-8 output through a
 * Windows shell corrupts the Arabic default values in the schema.
 *
 * Run: npm run db:migration:baseline
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "prisma/migrations";
const SCHEMA = "prisma/schema.prisma";
const HEADER = "scripts/baseline-header.sql";

function run(args: string[]): string {
  return execFileSync("npx", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: true,
  });
}

console.log("\n— توليد الترحيل الأساسي من prisma/schema.prisma —\n");

const ddl = run([
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  SCHEMA,
  "--script",
]);

if (!/create table/i.test(ddl)) {
  console.error("✗ لم يُولَّد أي DDL — تحقّق من prisma/schema.prisma");
  process.exit(1);
}

// Replace any previous baseline so the folder stays a single, clean migration.
for (const entry of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const name = entry.name;
    console.log(`  · إزالة الترحيل القديم: ${name}`);
    rmSync(join(MIGRATIONS_DIR, name), { recursive: true, force: true });
  }
}

// Prisma expects YYYYMMDDHHMMSS with no separators at all.
const stamp = new Date()
  .toISOString()
  .slice(0, 19)
  .replace(/[-:T]/g, "");

const dir = join(MIGRATIONS_DIR, `${stamp}_baseline`);
mkdirSync(dir, { recursive: true });

const header = readFileSync(HEADER, "utf8").trimEnd();
writeFileSync(join(dir, "migration.sql"), `${header}\n\n${ddl.trim()}\n`, "utf8");

const tables = (ddl.match(/CREATE TABLE/gi) ?? []).length;
console.log(`  ✓ ${dir}`);
console.log(`    ${tables} جدول · ${ddl.split("\n").length} سطر\n`);