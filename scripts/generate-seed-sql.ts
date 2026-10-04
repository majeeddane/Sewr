/**
 * Generates supabase/seed.sql from the local SQLite database.
 *
 * Reading the already-seeded development database guarantees the SQL matches
 * exactly what `npm run db:seed` produces — same content, same ordering, same
 * bcrypt hashes — so the Supabase SQL editor and a local `db:seed` never drift.
 *
 * Run: npm run seed:sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = "supabase/seed.sql";

/** Escapes a value for a single-quoted PostgreSQL literal. */
function lit(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;

  const text = String(value).replace(/'/g, "''");
  // Guard against the NUL byte, which PostgreSQL text cannot store.
  return `'${text.replace(/\0/g, "")}'`;
}

function cols(rows: Record<string, unknown>[], skip: string[] = []): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]!).filter((key) => !skip.includes(key));
}

function insert(
  table: string,
  rows: Record<string, unknown>[],
  conflict: string[],
  updateCols: string[] = [],
): void {
  if (!rows.length) return;
  const keys = cols(rows);
  const header = keys.map((k) => `"${k}"`).join(", ");

  // Quoted, because PostgreSQL lowercases unquoted identifiers and the schema
  // uses camelCase columns ("postId", "tagId").
  const target = conflict.map((c) => `"${c}"`).join(", ");

  const values = rows
    .map(
      (row) =>
        `    (${keys.map((k) => lit(row[k])).join(", ")})`,
    )
    .join(",\n");

  const action =
    updateCols.length > 0
      ? `do update set ${updateCols.map((c) => `"${c}" = excluded."${c}"`).join(", ")}`
      : "do nothing";

  out.push(`insert into ${table} (${header}) values\n${values}\non conflict (${target}) ${action};`);
  out.push("");
}

const out: string[] = [];
let totalRows = 0;

async function main() {
  console.log("\n— توليد supabase/seed.sql من قاعدة التطوير —\n");

  const [users, settings, trust, steps, values, why, stats, testimonials, faqs,
    content, categories, tags, posts, pages, clients, appointments, messages] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.siteSetting.findMany(),
      prisma.trustItem.findMany({ orderBy: { order: "asc" } }),
      prisma.processStep.findMany({ orderBy: { order: "asc" } }),
      prisma.valueItem.findMany({ orderBy: { order: "asc" } }),
      prisma.whyItem.findMany({ orderBy: { order: "asc" } }),
      prisma.statistic.findMany({ orderBy: { order: "asc" } }),
      prisma.testimonial.findMany({ orderBy: { order: "asc" } }),
      prisma.faq.findMany({ orderBy: { order: "asc" } }),
      prisma.contentItem.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }] }),
      prisma.category.findMany({ orderBy: { order: "asc" } }),
      prisma.tag.findMany(),
      prisma.post.findMany({ orderBy: { createdAt: "asc" }, include: { tags: true } }),
      prisma.page.findMany(),
      prisma.client.findMany({ orderBy: { code: "asc" } }),
      prisma.appointment.findMany(),
      prisma.contactMessage.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  out.push("-- ═══════════════════════════════════════════════════════════════════════");
  out.push("--  سوار وعي — بيانات أولية (Seed)");
  out.push("--");
  out.push("--  مُولَّد آليًا من قاعدة التطوير بواسطة:  npm run seed:sql");
  out.push("--  نفس محتوى: npm run db:seed");
  out.push("--");
  out.push("--  ★ اقرأ هذا قبل التشغيل:");
  out.push("--    البيانات التجريبية (مستفيدون ومواعيد ورسالة تجريبية) موجودة هنا");
  out.push("--    لتسهيل استكشاف اللوحة. احذفها من لوحة التحكم قبل الإطلاق.");
  out.push("--");
  out.push("--  ★ كلمة مرور المدير هنا هي الافتراضية المعلنة في المستودع.");
  out.push("--    غيّرها فورًا بعد أول تسجيل دخول.");
  out.push("-- ═══════════════════════════════════════════════════════════════════════");
  out.push("");
  out.push("begin;");
  out.push("");

  insert("users", users as never[], ["id"]);
  insert("site_settings", settings as never[], ["id"]);
  insert("trust_items", trust as never[], ["id"]);
  insert("process_steps", steps as never[], ["id"]);
  insert("value_items", values as never[], ["id"]);
  insert("why_items", why as never[], ["id"]);
  insert("statistics", stats as never[], ["id"]);
  insert("testimonials", testimonials as never[], ["id"]);
  insert("faqs", faqs as never[], ["id"]);
  insert("content_items", content as never[], ["id"]);
  insert("categories", categories as never[], ["id"]);
  insert("tags", tags as never[], ["id"]);
  insert(
    "posts",
    // `post_tags` is a join table and gets its own insert below.
    posts.map((post) => {
      const row = { ...post } as Record<string, unknown>;
      delete row.tags;
      return row;
    }) as never[],
    ["id"],
  );
  insert(
    "post_tags",
    posts.flatMap((p) => p.tags.map((t) => ({ postId: p.id, tagId: t.tagId }))) as never[],
    ["postId", "tagId"],
  );
  insert("pages", pages as never[], ["id"]);
  insert("clients", clients as never[], ["id"]);
  insert("appointments", appointments as never[], ["id"]);
  insert("contact_messages", messages as never[], ["id"]);

  totalRows =
    users.length + settings.length + trust.length + steps.length + values.length +
    why.length + stats.length + testimonials.length + faqs.length +
    content.length + categories.length + tags.length + posts.length +
    pages.length + clients.length + appointments.length + messages.length;

  out.push("commit;");
  out.push("");
  out.push("-- تم: " + totalRows + " سجلًا.");

  writeFileSync(OUT, out.join("\n"), "utf8");

  console.log(`  ✓ ${OUT}`);
  console.log(`    ${users.length} مستخدم · ${content.length} عنصر محتوى · ${posts.length} مقال`);
  console.log(`    ${faqs.length} سؤال شائع · ${clients.length} طلب · ${totalRows} إجمالي السجلات`);
  console.log(`    الحجم: ${(readFileSync(OUT, "utf8").length / 1024).toFixed(0)} كيلوبايت\n`);
}

main()
  .catch((error) => {
    console.error("✗ فشل التوليد:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
