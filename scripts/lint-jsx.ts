/**
 * Scans JSX *text nodes* for stray Latin words inside Arabic copy.
 *
 * `scripts/lint-content.ts` guards the seeded content files; this one guards
 * the components, catching the same class of machine-translation artefact
 * ("طلبك wholly سرّي") before it reaches a page.
 *
 * Run: npx tsx scripts/lint-jsx.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Words that legitimately appear in Arabic UI copy. */
const ALLOWED = new Set([
  // Brand / technical terms
  "Sewr", "Waie", "CBT", "PDPL", "SEO", "HTTPS", "GA",
  // Verbs the UI shows literally
  "Send", "Cancel", "Save", "Delete", "Edit", "Search", "Login", "Logout",
  "Upload", "Download", "Copy", "Close", "Open", "Confirm", "Preview",
  "Email", "Phone", "Password", "Type", "Email", "Loading", "Submit",
  "Optional", "Required", "NotFound",
  // Placeholder values inside attributes (not prose)
  "example", "com", "https", "http", "mailto", "tel", "wa", "me", "s", "h",
  "src", "href", "ltr", "rtl", "ar", "en", "admin",
]);

const CJK = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      out.push(...walk(full));
    } else if (/\.tsx$/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extracts **pure JSX text nodes** from a line — the characters a visitor
 * actually reads. Deliberately strict: anything containing code punctuation
 * (`=`, `{`, `}`, quotes) is an attribute or an expression and is skipped, so
 * the linter never reports TypeScript identifiers.
 */
function proseOf(line: string): string[] {
  const chunks: string[] = [];
  const pattern = />([^<>{}="'`$]*[؀-ۿ][^<>{}="'`$]*)</g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const chunk = (match[1] ?? "").trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

let problems = 0;

for (const file of walk("src")) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;

    if (CJK.test(line) && /[؀-ۿ]/.test(line)) {
      console.error(`[CJK]    ${file}:${lineNo}  ${line.trim().slice(0, 110)}`);
      problems += 1;
    }

    for (const chunk of proseOf(line)) {
      if (!/[؀-ۿ]/.test(chunk)) continue;
      for (const word of chunk.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? []) {
        if (ALLOWED.has(word)) continue;
        if (/^[A-Z]{2,}$/.test(word)) continue; // enum-ish constants
        if (/^[a-z]+(-[a-z0-9]+)+$/.test(word)) continue; // slugs
        console.error(
          `[LATIN]  ${file}:${lineNo}  "${word}"  |  ${chunk.trim().slice(0, 80)}`,
        );
        problems += 1;
      }
    }
  });
}

console.log(
  problems === 0 ? "\n✓ JSX content lint clean" : `\n✗ ${problems} issue(s) found`,
);
process.exitCode = problems === 0 ? 0 : 1;
