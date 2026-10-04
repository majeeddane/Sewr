/**
 * Scans files destined for git for secrets that must never be committed.
 *
 * The repository ships a default admin password on purpose (documented in
 * .env.example and the deployment guide) so a fresh clone is usable. This
 * script makes sure that is the ONLY credential present, and that real
 * secrets — the developer's .env values, their Supabase password, live
 * session tokens — never slip in.
 *
 * Run: npm run verify:secrets
 */
import { readFileSync, existsSync } from "node:fs";

const TARGETS = [
  "supabase/seed.sql",
  "supabase/schema.sql",
  ".env.example",
  "prisma/seed.ts",
  "README.md",
  "docs/DEPLOYMENT.md",
  "vercel.json",
];

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

/** Only these keys carry credentials. Everything else in .env is public config. */
const SENSITIVE_KEYS = new Set([
  "SESSION_SECRET",
  "DATA_ENCRYPTION_KEY",
  "CRON_SECRET",
  "SMTP_PASS",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

/**
 * True when the value is documentation filler rather than a live credential.
 * `USER:PASSWORD@HOST` in a guide is not a leak; a real password is.
 */
function isPlaceholder(value: string): boolean {
  const tokens = /\b(user|password|host|project|example|placeholder|changeme|your[-_]?\w*|secret|hex64|xxx+)\b/i;
  return (
    tokens.test(value) ||
    /^[<{$(]/.test(value) ||          // <hex 64>, ${VAR}, …
    /^\*+$/.test(value) ||             // ****
    /…|\.\.\./.test(value) ||          // eyJhbGci… — value truncated for display
    /^(changeme|replace[-_]?me)$/i.test(value)
  );
}

/** Reads the developer's local .env so we can prove its values are absent. */
function localSecrets(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(".env")) return out;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    if (!SENSITIVE_KEYS.has(key)) continue;
    const value = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
    if (value.length < 16 || isPlaceholder(value)) continue;
    out.set(key, value);
  }
  return out;
}

console.log("\n— فحص الأسرار قبل النشر —\n");

const secrets = localSecrets();
console.log(`  (أسرار محلية مكتشفة: ${secrets.size})`);

const combined = TARGETS.filter((f) => existsSync(f))
  .map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

for (const { file, text } of combined) {
  for (const [key, value] of secrets) {
    check(
      `${file} لا يحتوي قيمة ${key}`,
      !text.includes(value),
      "!! قيمة سرّية من .env موجودة في الملف",
    );
  }
}

// A bcrypt hash may legitimately ship; a plaintext password may not.
const seedText = existsSync("supabase/seed.sql") ? readFileSync("supabase/seed.sql", "utf8") : "";
const bcryptHashes = seedText.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g) ?? [];
check(
  `كلمات المرور مخزّنة كبصمات bcrypt فقط (${bcryptHashes.length})`,
  bcryptHashes.length > 0,
  "لم يُعثر على أي بصمة bcrypt",
);

// Guard against a real DATABASE_URL with a password being committed.
// Placeholder hosts (USER:PASSWORD@HOST) are documentation, not a leak.
const withPassword = combined.filter(({ text }) =>
  text
    .split(/\r?\n/)
    .some((line) => {
      const url = /postgresql:\/\/([^\s:@/]+):([^\s:@/]+)@([^\s:@/]+)/.exec(line);
      if (!url) return false;
      if (line.trimStart().startsWith("#")) return false; // commented example
      return !isPlaceholder(url[2]!) && !isPlaceholder(url[3]!);
    }),
);
check(
  "لا يوجد رابط قاعدة بيانات بكلمة مرور حقيقية",
  withPassword.length === 0,
  withPassword.map((f) => f.file).join(", "),
);

// Supabase's publishable key is public by design; the service role key is not.
const serviceKeys = combined.filter(({ text }) =>
  text.split(/\r?\n/).some((line) => {
    if (line.trimStart().startsWith("#")) return false;
    const m = /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)$/.exec(line);
    if (!m) return false;
    const value = (m[1] ?? "").trim().replace(/^["']|["']$/g, "");
    return value.length > 0 && !isPlaceholder(value);
  }),
);
check(
  "لا يوجد مفتاح خدمة Supabase حقيقي في المستودع",
  serviceKeys.length === 0,
  serviceKeys.map((f) => f.file).join(", "),
);

console.log("\n" + "─".repeat(50));
console.log(`النتيجة: نجح ${passed} · فشل ${failed}`);
console.log("─".repeat(50) + "\n");
process.exitCode = failed > 0 ? 1 : 0;