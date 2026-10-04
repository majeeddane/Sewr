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

/** Prisma error codes we treat as "the database is not usable right now". */
const TRANSIENT_CODES = new Set([
  "P1000", // authentication failed
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1003", // database does not exist
  P1008_ERR(), // operation timed out
  "P1010", // access denied
  "P1011", // TLS connection error
  "P1017", // server has closed the connection
]);

// P1008 is defined inline to keep the list readable.
function P1008_ERR(): string {
  return "P1008";
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");

  if (/Environment variable not found:\s*DATABASE_URL/i.test(message)) return true;
  if (/Can't reach database server/i.test(message)) return true;
  if (/the database server is not available/i.test(message)) return true;
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ETIMEDOUT/i.test(message)) return true;

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;

  // Prisma wraps driver errors; the cause carries the real code.
  const cause = (error as { cause?: unknown }).cause;
  if (cause && cause !== error) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === "string" && TRANSIENT_CODES.has(causeCode)) return true;
  }

  return false;
}

let warned = false;

/**
 * Runs a query and returns `fallback` when the database is unreachable.
 *
 * Only connectivity problems are swallowed. A genuine bug (bad SQL, missing
 * column) still throws, so real errors are never hidden.
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
      console.warn(
        [
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
