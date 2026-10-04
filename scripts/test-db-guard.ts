/**
 * Tests the database guard in src/lib/db-fallback.ts.
 *
 * A guard that swallows errors is the most dangerous kind of code in this
 * project: if it is too eager it hides real bugs behind a blank page, and if
 * it is too strict it fails deployments for no reason. These tests pin down
 * both edges.
 *
 * Run: npm run test:db-guard
 */
import { isDatabaseUnavailable } from "../src/lib/db-fallback";

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

/** Mirrors the shape Prisma throws. */
function prismaError(code: string, message: string, meta?: Record<string, unknown>) {
  const error = new Error(message) as Error & { code: string; meta?: unknown };
  error.code = code;
  if (meta) error.meta = meta;
  return error;
}

console.log("\n— اختبار حارس قاعدة البيانات —\n");

/** Prisma throws this wrapper around a datasource validation failure. */
class PrismaClientInitializationErrorLike extends Error {
  name = "PrismaClientInitializationError";
  clientVersion = "6.19.3";
}

// ── Must degrade gracefully ──
const recoverable: Array<[string, unknown]> = [
  ["DATABASE_URL غير مضبوط", new Error("Environment variable not found: DATABASE_URL.")],
  ["تعذّر الوصول للخادم", prismaError("P1001", "Can't reach database server at `db:5432`")],
  ["انتهاء المهلة", prismaError("P1002", "Timed out fetching a new connection")],
  ["قاعدة البيانات غير موجودة", prismaError("P1003", "The database does not exist")],
  ["فشل المصادقة", prismaError("P1000", "Authentication failed against database server")],
  ["الجدول غير موجود (المشكلة الحالية)", prismaError("P2021", "The table `public.pages` does not exist in the current database.", { table: "public.pages" })],
  ["الجدول غير موجود برسالة فقط", new Error("The table `public.users` does not exist in the current database.")],
  ["ECONNREFUSED", new Error("connect ECONNREFUSED 127.0.0.1:5432")],
  ["رمز داخل cause", Object.assign(new Error("wrapped"), { cause: prismaError("P1011", "TLS error") })],
  // Wrong credentials are a DATABASE_URL misconfiguration, not a code bug.
  ["صلاحيات خاطئة", prismaError("P1010", "User does not have permission to perform this operation")],
  // provider and URL scheme disagree — a configuration mistake.
  ["عدم تطابق البروتوكول", new Error("error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.")],
  ["مصدر بيانات غير صالح", new PrismaClientInitializationErrorLike("Error validating datasource `db`")],
];

for (const [label, error] of recoverable) {
  check(`يُتعامل مع: ${label}`, isDatabaseUnavailable(error));
}

// ── Must NOT be swallowed: real bugs must stay loud ──
const fatal: Array<[string, unknown]> = [
  ["عمود غير موجود (انحراف مخطط)", prismaError("P2022", "Column `foo` does not exist on the `pages` table.")],
  ["قيد فريد خالف", prismaError("P2002", "Unique constraint failed on the fields: (`slug`)")],
  ["قيد مفتاح أجنبي", prismaError("P2003", "Foreign key constraint failed on the field: `programId`")],
  ["SQL مُحرَّف", prismaError("P2010", "Raw query failed. Code: 42601")],
  ["خطأ برمجي عادي", new Error("Cannot read properties of undefined")],
  ["قيمة فارغة", null],
  ["قيمة غير خطأ", { foo: "bar" }],
];

for (const [label, error] of fatal) {
  check(`لا يُخفي: ${label}`, !isDatabaseUnavailable(error));
}

// The distinction that matters most: a missing column is drift and must fail,
// while a missing table merely means the schema has not been applied yet.
check(
  "التمييز الأساسي: الجدول يُتحمَّل والعمود لا",
  isDatabaseUnavailable(prismaError("P2021", "table does not exist")) === true &&
    isDatabaseUnavailable(prismaError("P2022", "column does not exist")) === false,
);

console.log("\n" + "─".repeat(50));
console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
console.log("─".repeat(50) + "\n");
process.exitCode = failed > 0 ? 1 : 0;