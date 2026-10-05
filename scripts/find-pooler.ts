/**
 * Finds the working Supabase Connection Pooler URL.
 *
 * Why this exists: Vercel's build machines resolve the direct database hostname
 * to IPv6, which Supabase's direct endpoint does not answer, so the build
 * fails with "Can't reach database server". The pooler hostname is the
 * supported fix. Its region prefix cannot be derived from the project ref, so
 * this script tries the documented regions and reports which one answers.
 *
 * The pooler username is the project ref; the password is the database
 * password. Two ports are tried: 5432 (session pooler) and 6543
 * (transaction pooler). Prisma requires a single transaction for its
 * interactive queries, so 6543 is only safe for migrations — 5432 is
 * preferred for a long-lived serverless client.
 *
 * Run: npx tsx scripts/find-pooler.ts <project-ref> <password>
 */
import { Client } from "pg";

const projectRef = process.argv[2];
const password = process.argv[3];
if (!projectRef || !password) {
  console.error("\n✗ الاستخدام: npx tsx scripts/find-pooler.ts <project-ref> <password>\n");
  process.exit(1);
}

const REGIONS = [
  "aws-0-eu-west-1",
  "aws-0-eu-central-1",
  "aws-0-us-east-1",
  "aws-0-us-west-2",
  "aws-0-ca-central-1",
  "aws-0-sa-east-1",
  "aws-0-ap-south-1",
  "aws-0-ap-southeast-1",
  "aws-0-ap-northeast-1",
  "aws-0-ap-southeast-2",
];

async function probe(url: string): Promise<string> {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query<{ n: number }>(`select count(*)::int as n from content_items`);
    const { rows: post } = await client.query<{ v: string }>(`select version() as v`);
    await client.end();
    return `works — ${rows[0]?.n} عنصر محتوى، ${String(post[0]?.v ?? "").split(" ").slice(0, 2).join(" ")}`;
  } catch (error) {
    await client.end().catch(() => {});
    const message = (error as Error).message;
    if (/tenant\/user .* not found/i.test(message)) return "منطقة خاطئة";
    if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return "المضيف غير موجود";
    if (/password authentication failed/i.test(message)) return "كلمة مرور خاطئة";
    if (/too many connections/i.test(message)) return "اتصالات ممتلئة";
    return message.slice(0, 60);
  }
}

async function main() {
  console.log(`\n— البحث عن عنوان pooler للمشروع ${projectRef} —\n`);

  for (const port of ["5432", "6543"]) {
    for (const region of REGIONS) {
      const url = `postgresql://${"postgres." + projectRef}:${password}@${region}.pooler.supabase.com:${port}/postgres`;
      const result = await probe(url);
      const mark = result.startsWith("works") ? "OK " : "-- ";
      console.log(`  ${mark}${region} :${port} — ${result}`);
      if (result.startsWith("works")) {
        console.log(`\n✓ الرابط الذي يعمل:\n${url}\n`);
        return;
      }
    }
  }

  console.log(
    "\n✗ لم يعمل أي عنوان.\n" +
      "  إن استمر الفشل فالسبب غالبًا كلمة المرور، وليس المنطقة.\n",
  );
}

main().catch((error) => {
  console.error("\n✗", error);
  process.exitCode = 1;
});