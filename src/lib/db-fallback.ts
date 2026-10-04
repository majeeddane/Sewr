/**
 * Database availability guard.
 *
 * A content-managed site must never fail to *deploy* because the database is
 * slow, cold, or not configured yet. Next.js prerenders public pages at build
 * time, so a single unreachable query would otherwise break the whole build.
 *
 * These helpers turn "database is not reachable" into an empty result and a
 * warning in the build log, so the deployment succeeds and the real content
 * appears on the first request once `DATABASE_URL` is valid.
 */

/**
 * Prisma error codes for a database we cannot use right now.
 *
 * P2021 ("table does not exist") belongs here because it almost always means
 * the schema simply has not been applied yet — the site is fine, the database
 * is empty. Blocking a deployment on that would trap the operator: they would
 * have to publish before they could publish.
 *
 * P2022 ("column does not exist") is deliberately NOT listed. That one means
 * the database schema and the Prisma schema have drifted apart, which is a
 * real bug that must fail loudly rather than silently render an empty page.
 */
const UNAVAILABLE_CODES = new Set([
  "P1000", // authentication failed
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1003", // database does not exist
  "P1008", // operation timed out
  "P1010", // access denied
  "P1011", // TLS connection error
  "P1017", // server has closed the connection
  "P2021", // table does not exist
]);

function codeOf(error: unknown): string | null {
  const direct = (error as { code?: unknown })?.code;
  if (typeof direct === "string") return direct;

  // Prisma wraps driver errors; the cause carries the real code.
  const cause = (error as { cause?: unknown })?.cause;
  if (cause && cause !== error) {
    const causeCode = (cause as { code?: unknown })?.code;
    if (typeof causeCode === "string") return causeCode;
  }
  return null;
}

/** The missing table name, so the warning can name it. */
function missingTable(error: unknown): string | null {
  const fromMeta = (error as { meta?: { table?: unknown } })?.meta?.table;
  if (typeof fromMeta === "string") return fromMeta.replace(/^public\./, "");

  const message = error instanceof Error ? error.message : String(error);
  const prisma = /table [`"]?(?:public\.)?(\w+)[`"]? does not exist/i.exec(message);
  if (prisma?.[1]) return prisma[1];

  const raw = /relation [`"](?:public\.)?(\w+)[`"]? does not exist/i.exec(message);
  return raw?.[1] ?? null;
}

/**
 * True when the database is unreachable or has no schema yet, so the caller can
 * degrade gracefully instead of failing the whole build.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");

  if (/Environment variable not found:\s*DATABASE_URL/i.test(message)) return true;
  if (/Can't reach database server/i.test(message)) return true;
  if (/the database server is not available/i.test(message)) return true;
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(message)) return true;

  // The provider in schema.prisma and the scheme of DATABASE_URL disagree —
  // e.g. provider "sqlite" with a postgresql:// URL. A configuration mistake,
  // so it degrades like the others instead of killing the build.
  if (/the URL must start with the protocol/i.test(message)) return true;
  if (/error validating datasource/i.test(message)) return true;

  // "The schema has not been applied." Prisma phrases this as
  // `does not exist in the current database` (P2021); a raw driver query
  // surfaces PostgreSQL's own `relation "x" does not exist` (SQLSTATE 42P01).
  if (/does not exist in the current database/i.test(message)) return true;
  if (/relation "(?:public\.)?\w+" does not exist/i.test(message)) return true;
  if (/relation with name \w+ does not exist/i.test(message)) return true;

  const code = codeOf(error);
  return code !== null && UNAVAILABLE_CODES.has(code);
}

let warned = false;

/**
 * Runs a query and returns `fallback` when the database is unreachable or has
 * no schema yet.
 *
 * Only those two problems are swallowed. A genuine bug — bad SQL, a missing
 * column, a constraint violation — still throws, so real errors are never
 * hidden behind a blank page.
 */
export async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const result = await run();
    // Reset the "warn once" latch once the database answers.
    if (warned) {
      warned = false;
      console.info(`[db] الاتصال بقاعدة البيانات عاد طبيعيًا (${label}).`);
    }
    return result;
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;

    if (!warned) {
      warned = true;
      const table = missingTable(error);
      console.warn(
        table
          ? [
              "",
              "════════════════════════════════════════════════════════════════",
              "⚠  قاعدة البيانات متصلة، لكن مخططها غير مُطبَّق بعد.",
              "",
              `   الجدول المفقود:  ${table}`,
              "",
              "   السبب الأرجح: رابط DATABASE_URL يشير إلى مشروع لا يحتوي الجداول.",
              "   الحل (دقيقتان من داخل Supabase ← SQL Editor):",
              "",
              "     ١) الصق محتوى supabase/schema.sql  ثم اضغط Run",
              "     ٢) الصق محتوى supabase/seed.sql    ثم اضغط Run",
              "     ٣) من Vercel: Redeploy",
              "",
              "   سيُبنى الموقع بنجاح الآن، لكن صفحاته ستظهر فارغة من المحتوى",
              "   حتى تُطبَّق الخطوات الثلاث أعلاه.",
              "════════════════════════════════════════════════════════════════",
              "",
            ].join("\n")
          : [
              "",
              "────────────────────────────────────────────────────────────────",
              "⚠  تعذّر الوصول إلى قاعدة البيانات أثناء البناء.",
              "",
              "   سيُبنى الموقع بنجاح، لكن الصفحات ستظهر فارغة من المحتوى حتى",
              "   تُضبط متغيرات البيئة التالية على منصة النشر:",
              "",
              "     DATABASE_URL       رابط اتصال قاعدة البيانات",
              "     SESSION_SECRET     مفتاح توقيع الجلسات",
              "     DATA_ENCRYPTION_KEY مفتاح تشفير البيانات الحساسة",
              "",
              "   بعد ضبطها، أعد البناء (Redeploy).",
              "────────────────────────────────────────────────────────────────",
              "",
            ].join("\n"),
      );
    }

    return fallback;
  }
}
