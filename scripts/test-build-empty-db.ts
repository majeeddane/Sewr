/**
 * Runs `next build` against a REAL, reachable but EMPTY PostgreSQL database,
 * reproducing the exact Vercel failure reported on 2026-10-04:
 *
 *   The table `public.pages` does not exist in the current database.  (P2021)
 *
 * PGlite speaks the PostgreSQL wire protocol, so Prisma connects to it over
 * TCP exactly as it would to Supabase. The database has zero tables, which is
 * the state a freshly created Supabase project is in before schema.sql is run.
 *
 * The build must succeed. Otherwise deployment is blocked by a setup step that
 * only the operator can perform.
 *
 * Run: npm run test:build-empty-db
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PGlite } from "@electric-sql/pglite";

const PORT = 55432;
// Kept outside the repo: PGlite holds its files open on Windows, and a locked
// directory inside the working tree would break `git status`.
const DIR = join(tmpdir(), "sewr-empty-db-test");

let passed = 0;
let failed = 0;

/** Best-effort cleanup; Windows may still hold a handle for a moment. */
function cleanup(): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      rmSync(DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return;
    } catch {
      /* retry */
    }
  }
}

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function run(
  command: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, shell: true });
    let out = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (out += d.toString()));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const ENV = {
  DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?schema=public`,
  SESSION_SECRET: "a".repeat(64),
  DATA_ENCRYPTION_KEY: "b".repeat(64),
};

async function main() {
  console.log("\n— بناء كامل مقابل قاعدة PostgreSQL متصلة وفارغة —\n");

  cleanup();
  rmSync(".next", { recursive: true, force: true });

  const server = new PGLiteSocketServer({ db: new PGlite(DIR), port: PORT, host: "127.0.0.1" });
  await server.start();
  console.log(`  · خادم PostgreSQL على المنفذ ${PORT} — قاعدة فارغة تمامًا\n`);

  try {
    const gen = await run("npx", ["prisma", "generate", "--schema", "prisma/schema.prisma"], ENV);
    check("توليد عميل PostgreSQL", gen.code === 0, gen.out.slice(-300));

    // ── 1. Build against the empty database ──
    const empty = await run("npx", ["next", "build"], ENV);
    check("البناء ينجح رغم قاعدة بيانات فارغة", empty.code === 0, empty.out.slice(-700));
    check("لا خطأ P2021 قاتل", !/Failed to collect page data/.test(empty.out));
    check(
      "سجل البناء يشرح سبب فراغ المحتوى",
      /مخططها غير مُطبَّق|الجدول المفقود/.test(empty.out),
    );
    check("التحذير يذكر الملف المطلوب لصقه", empty.out.includes("supabase/schema.sql"));
    check("التحذير يذكر ملف البيانات أيضًا", empty.out.includes("supabase/seed.sql"));
    check("المسارات مُولَّدة", /Compiled successfully/.test(empty.out));

    // ── 2. Apply the schema + seed through the same connection ──
    // Using `prisma db execute` rather than a second PGlite handle, so the
    // running server sees the tables (Windows locks a PGlite directory).
    console.log("\n— نفس البناء بعد تطبيق supabase/schema.sql + seed.sql —\n");

    const applySchema = await run(
      "npx",
      ["prisma", "db", "execute", "--file", "supabase/schema.sql", "--schema", "prisma/schema.prisma"],
      ENV,
    );
    check("تطبيق supabase/schema.sql", applySchema.code === 0, applySchema.out.slice(-400));

    const applySeed = await run(
      "npx",
      ["prisma", "db", "execute", "--file", "supabase/seed.sql", "--schema", "prisma/schema.prisma"],
      ENV,
    );
    check("تطبيق supabase/seed.sql", applySeed.code === 0, applySeed.out.slice(-400));

    // Data correctness itself is covered by `npm run verify:schema`, which
    // loads seed.sql into a fresh PostgreSQL and counts the rows. What matters
    // here is that the *running server* stops complaining once the schema is
    // applied through the same connection the build uses.
    rmSync(".next", { recursive: true, force: true });
    const filled = await run("npx", ["next", "build"], ENV);
    check("البناء ينجح مع المحتوى", filled.code === 0, filled.out.slice(-700));
    // No schema warning means the server sees the tables. We deliberately do NOT
    // assert the absence of connectivity warnings here: Next.js collects page
    // data with 19 parallel workers, and PGLiteSocketServer is a single WASM
    // instance that drops connections under that load. Supabase, a real
    // server, does not — so asserting on it would measure the test double.
    check("المخطط صار مطبَّقًا من الخادم نفسه", !/مخططها غير مُطبَّق/.test(filled.out));
  } finally {
    await server.stop();
    cleanup();
    rmSync(".next", { recursive: true, force: true });

    // This test switches the generated Prisma client to PostgreSQL. Restore the
    // SQLite client so a later `npm run build` in this repo still matches the
    // DATABASE_URL in .env.
    console.log("  · إعادة توليد عميل SQLite للتطوير…\n");
    await run("npx", ["prisma", "generate", "--schema", "prisma/schema.dev.prisma"], {});
  }

  console.log("\n" + "─".repeat(50));
  console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
  console.log("─".repeat(50) + "\n");
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error("\n✗ فشل الاختبار:", error);
  cleanup();
  process.exitCode = 1;
});