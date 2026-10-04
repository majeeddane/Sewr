/**
 * Same machine-translation artefact check as lint-jsx.ts, applied to the
 * Markdown documents: flags stray Latin words sitting inside Arabic sentences.
 *
 * Run: npx tsx scripts/lint-docs.ts
 */
import { readFileSync, existsSync } from "node:fs";

const FILES = [
  "README.md",
  "docs/DEPLOYMENT.md",
  "docs/ADMIN-GUIDE.md",
  "AGENTS.md",
];

/** Latin that legitimately appears in Arabic documentation. */
const ALLOWED = new Set([
  "Next", "next", "TypeScript", "JavaScript", "Tailwind", "Prisma", "prisma",
  "PostgreSQL", "SQL", "Supabase", "Vercel", "vercel", "Node", "node", "npm",
  "npx", "tsx", "ESLint", "lint", "React", "Zod", "bcrypt", "AES", "GCM",
  "HMAC", "SHA", "PDF", "HTML", "CSS", "JSON", "RLS", "JWT", "CSRF", "XSS",
  "HTTPS", "HSTS", "SameSite", "httpOnly", "Secure", "PDPL", "SMTP",
  "SMTP2GO", "DATABASE_URL", "SESSION_SECRET", "DATA_ENCRYPTION_KEY",
  "ADMIN_EMAIL", "ADMIN_PASSWORD", "NEXT_PUBLIC", "SITE_URL", "SMTP_HOST",
  "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "NOTIFICATION_EMAIL", "STORAGE_DRIVER", "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET", "CRON_SECRET",
  "NODE_ENV", "schema", "dev", "build", "start", "seed", "studio", "setup",
  "deploy", "generate", "typecheck", "test", "smoke", "content", "json",
  "ts", "md", "tsx", "svg", "jpg", "png", "webp", "avif", "gif",
  "public", "uploads", "placeholders", "fonts", "src", "app", "lib",
  "components", "scripts", "docs", "db", "push", "reset", "pull",
  "cp", "curl", "pg_dump", "gunzip", "psql", "openssl", "systemctl",
  "nginx", "certbot", "crontab", "sudo", "mkdir", "find", "rsync",
  "nano", "chmod", "chown", "apt", "user", "server", "root", "var", "www",
  "etc", "conf", "ini", "log", "gz", "enc", "ip", "rc", "conf",
  "localhost", "https", "http", "www", "com", "sa", "org", "net", "io",
  "am", "pm", "utc", "GET", "POST", "PUT", "DELETE", "PATCH", "IP",
  "OG", "SEO", "CSV", "UI", "UX", "API", "CTRL", "Mac", "Linux",
  "Windows", "Ctrl", "F5", "Esc", "Enter", "and", "or", "the", "for",
  "not", "is", "are", "to", "of", "in", "on", "with", "at", "by", "from",
  "as", "it", "be", "this", "that", "you", "can", "will", "if", "root",

  // Product / vendor names
  "Sewr", "Waie", "SQLite", "Storage", "Google", "Excel", "GitHub",
  "GitLab", "Git", "Canonical", "Sitemap", "Next", "Node", "Noto",
  "Kufi", "Plex", "Sans", "Arabic", "Open", "Font", "License", "WebP",
  "IntersectionObserver", "honeypot", "reCAPTCHA", "HTML5", "SHA256",

  // Deployment / infra terms
  "pooler", "IPv4", "encoded", "Production", "Environment", "Variables",
  "Project", "Settings", "Database", "Connection", "String", "Auth",
  "Session", "Server", "Security", "Row", "Level", "Component", "Client",
  "Editor", "Action", "cron", "UTC", "S3", "Bearer", "Authorization",
  "Point-in-Time", "Recovery", "Encrypt", "CHANGE_ME", "Strict-Transport",
  "robots", "admin", "api", "string",
  "Node.js", "Next.js", "Let's", "Encrypt",
  "Hobby", "Pro", "Team", "Enterprise",
]);

const CJK = new RegExp(
  "[\\u3000-\\u303F\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF]",
);
const HAS_ARABIC = new RegExp("[\\u0600-\\u06FF]");
const WORD = new RegExp("[A-Za-z][A-Za-z0-9_'.@-]{2,}", "g");
const FENCE = new RegExp("^\\s*```");
const SLUG = new RegExp("^[a-z]+(-[a-z0-9]+)+$");
const ACRONYM = new RegExp("^[A-Z]{2,}$");
const URLISH = new RegExp("^(https?|mailto|tel):");
const NON_WORD = new RegExp("[^A-Za-z0-9]", "g");

/** Strips inline code, link targets and image URLs — none of it is prose. */
function prose(line: string): string {
  return line
    .replace(/`[^`]*`/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/<[^>]*>/g, " ");
}

let problems = 0;

for (const file of FILES) {
  if (!existsSync(file)) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNo = i + 1;
    const trimmed = line.trim();

    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (CJK.test(line)) {
      console.error("[CJK]   " + file + ":" + lineNo + "  " + trimmed.slice(0, 110));
      problems += 1;
    }

    const text = prose(line);
    if (!HAS_ARABIC.test(text)) continue;
    // Markdown table rows and headings-of-code are structure, not prose.
    if (/^\s*\|/.test(line)) continue;

    const words = text.match(WORD) ?? [];
    for (const word of words) {
      const bare = word.replace(NON_WORD, "");
      if (ALLOWED.has(word) || ALLOWED.has(bare)) continue;
      if (SLUG.test(word) || ACRONYM.test(word) || URLISH.test(word)) continue;
      console.error(
        "[LATIN] " + file + ":" + lineNo + '  "' + word + '"  |  ' + trimmed.slice(0, 85),
      );
      problems += 1;
    }
  }
}

console.log(
  problems === 0 ? "\n✓ docs lint clean" : "\n✗ " + problems + " issue(s) found",
);
process.exitCode = problems === 0 ? 0 : 1;
