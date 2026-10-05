/**
 * Prints the key site_settings fields and a content count from the connected
 * database, so we can tell whether a blank site means "database unreachable"
 * or "database reachable but those fields are empty".
 *
 * Run: DATABASE_URL="postgresql://..." npx tsx scripts/check-content.ts
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n✗ اضبط DATABASE_URL أولًا.\n");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: settings } = await client.query<Record<string, unknown>>(
    `select "siteName", tagline, "heroBadge", "heroTitle", "heroDescription",
            "homeAboutTitle", "homeAboutText"
     from site_settings`,
  );

  const row = settings[0] ?? {};
  console.log("\n— حقول site_settings —\n");
  for (const [key, value] of Object.entries(row)) {
    const text = value === null || value === "" ? "(فارغ)" : String(value);
    console.log(`  ${key.padEnd(20)} ${text.slice(0, 70)}`);
  }

  const { rows: counts } = await client.query<Record<string, number>>(
    `select
       count(*) filter (where "isActive")::int              as active,
       count(*) filter (where "isFeatured")::int            as featured,
       count(*)::int                                        as total
     from content_items`,
  );
  console.log("\n— content_items —");
  console.log(`  نشط: ${counts[0]?.active} · مميّز: ${counts[0]?.featured} · الإجمالي: ${counts[0]?.total}`);

  const { rows: blocks } = await client.query<Record<string, number>>(
    `select
       (select count(*)::int from trust_items where "isActive")    as trust,
       (select count(*)::int from process_steps where "isActive")  as steps,
       (select count(*)::int from value_items where "isActive")   as values,
       (select count(*)::int from why_items where "isActive")     as why,
       (select count(*)::int from statistics where "isActive")    as stats,
       (select count(*)::int from testimonials where "isActive") as voices,
       (select count(*)::int from faqs where "isActive")         as faqs`,
  );
  console.log("\n— كتل الصفحة الأولى —");
  for (const [key, value] of Object.entries(blocks[0] ?? {})) {
    console.log(`  ${key.padEnd(10)} ${value}`);
  }

  await client.end();
  console.log("");
}

main().catch((error) => {
  console.error("\n✗", error);
  process.exitCode = 1;
});