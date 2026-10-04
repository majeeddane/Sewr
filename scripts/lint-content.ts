/**
 * Content lint: catches machine-translation artefacts that must never reach
 * production Arabic copy — CJK characters, replacement chars, and stray
 * multi-letter Latin words outside an allow-list (brand/technical terms).
 *
 * Run with:  npx tsx scripts/lint-content.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { ICON_REGISTRY } from "../src/lib/icons";

const ICON_NAMES = new Set(Object.keys(ICON_REGISTRY));

const FILES = [
  "prisma/content/services.ts",
  "prisma/content/services-b.ts",
  "prisma/content/programs.ts",
  "prisma/content/protocols.ts",
  "prisma/content/pages.ts",
  "prisma/content/posts.ts",
];

const ALLOWED_LATIN = new Set([
  "CBT", "PDPL", "SEO", "HTML", "CMS", "PDF", "SLA", "wa", "me", "Sewr", "Waie",
  "IBMS", "ICT", "SPSS", "PDF", "UX", "UI", "AI", "GDPR", "HTTPS", "SSL",
  "SMART", "Matrix", "Minnesota", "Steps", "Recovery", "Art", "Support",
  "Community", "Behavior", "Sport", "Program", "Services", "Care", "Team",
  "Social", "Family", "Therapy", "Clinical", "Religious", "Guardian", "Hi",
  "OK", "IV", "vs", "et", "al", "PDF", "X", "the", "and", "of", "to", "in",
]);

const CJK = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const REPLACEMENT = /[\uFFFD\u{200B}-\u{200F}\u2028\u2029]/u;

const files = FILES.filter((f) => existsSync(f));
let problems = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (CJK.test(line)) {
      console.error(`[CJK]      ${file}:${lineNo}  ${line.trim().slice(0, 120)}`);
      problems += 1;
    }
    if (REPLACEMENT.test(line)) {
      console.error(`[HIDDEN]   ${file}:${lineNo}  ${line.trim().slice(0, 120)}`);
      problems += 1;
    }

    // Latin words inside Arabic copy that are not in the allow-list.
    const hasArabic = /[\u0600-\u06FF]/.test(line);
    const isComment = /^\s*(\*|\/\/|\/\*)/.test(line);
    // `export const PRIVACY_HTML = ...` is code, not prose.
    const isDeclaration = /^\s*export\s+(const|default)\s+[A-Z_0-9]+\s*=/.test(line);
    if (!hasArabic || isComment || isDeclaration) return;

    // Strip HTML tags, TS object keys and template punctuation first.
    const prose = line
      .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
      .replace(/(\{|,)\s*[a-zA-Z_$][\w$]*\s*:\s*/g, "$1 ")
      .replace(/^\s*[a-zA-Z_$][\w$]*\s*:\s*/, "")
      .replace(/`|[{}();=,[\]]/g, " ");

    const latinWords = prose.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [];
    for (const word of latinWords) {
      // kebab-case slugs and icon names are intentional
      if (/^[a-z]+(-[a-z0-9]+)+$/.test(word)) continue;
      if (ICON_NAMES.has(word)) continue;
      if (!ALLOWED_LATIN.has(word)) {
        console.error(`[LATIN?]   ${file}:${lineNo}  "${word}"  in: ${line.trim().slice(0, 90)}`);
        problems += 1;
      }
    }
  });
}

console.log(problems === 0 ? "\n✓ content lint clean" : `\n✗ ${problems} issue(s) found`);
process.exit(problems === 0 ? 0 : 1);
