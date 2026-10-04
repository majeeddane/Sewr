import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

/**
 * Field-level encryption for beneficiary data.
 *
 * The data we store here relates to addiction recovery, so it is treated as
 * sensitive personal data under the Saudi PDPL. Names are indexed in clear
 * (the dashboard needs to sort and search them), but phone numbers, e-mail
 * addresses, free-text notes and message bodies are encrypted at rest with
 * AES-256-GCM.
 *
 * To keep search working without decrypting every row we also store a
 * deterministic HMAC "blind index" of each value.
 */

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const KEY_SALT = "sewr-waie-field-encryption";

function masterSecret(): string {
  const secret =
    process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || "";
  if (!secret) {
    throw new Error(
      "DATA_ENCRYPTION_KEY is not set. Copy .env.example to .env and generate a secret with: openssl rand -hex 32",
    );
  }
  return secret;
}

/** 32-byte key derived from the configured secret. */
let cachedKey: Buffer | null = null;
function derivedKey(): Buffer {
  if (!cachedKey) {
    cachedKey = createHash("sha256").update(`${masterSecret()}::${KEY_SALT}`).digest();
  }
  return cachedKey;
}

function blindMac(normalized: string): string {
  return createHmac("sha256", masterSecret())
    .update(`idx:${normalized}`)
    .digest("hex")
    .slice(0, 40);
}

/** Encrypts a string. Returns `v1:iv:tag:ciphertext` (all base64url). */
export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, derivedKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

/** Decrypts a value produced by {@link encrypt}. Never throws. */
export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, iv, tag, data] = payload.split(":");
    if (version !== VERSION || !iv || !tag || data === undefined) return null;
    const decipher = createDecipheriv(
      ALGO,
      derivedKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Deterministic index used for equality lookups (duplicate detection,
 * "search by phone") without storing the plaintext.
 */
export function blindIndex(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeForIndex(value);
  if (!normalized) return null;
  return blindMac(normalized);
}

// ── Value normalisation ───────────────────────────────────────

/** Converts Arabic-Indic (٠١٢…) digits to ASCII. */
function toAsciiDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Strips formatting so 05x 123 4567 matches 05x-123-4567. */
export function normalizePhone(value: string): string {
  let v = toAsciiDigits(String(value ?? "")).trim();
  v = v.replace(/[^\d+]/g, "");
  if (v.startsWith("+966")) v = `0${v.slice(4)}`;
  else if (v.startsWith("966") && v.length > 10) v = `0${v.slice(3)}`;
  else if (v.startsWith("00")) v = `0${v.slice(2)}`;
  return v;
}

export function normalizeEmail(value: string): string {
  return toAsciiDigits(String(value ?? "")).trim().toLowerCase();
}

function normalizeForIndex(value: string): string {
  return value.includes("@") ? normalizeEmail(value) : normalizePhone(value);
}

/** Normalised name used for case-insensitive search on any SQL dialect. */
export function normalizeName(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Masking helpers (safe to render in list views / logs) ─────

export function phoneLast4(value: string | null | undefined): string | null {
  const n = normalizePhone(value ?? "");
  return n.length >= 4 ? n.slice(-4) : null;
}

export function maskPhone(value: string | null | undefined): string {
  const n = normalizePhone(value ?? "");
  if (n.length < 5) return n ? "••••" : "";
  return `${"•".repeat(Math.max(3, n.length - 4))}${n.slice(-4)}`;
}

export function maskEmail(value: string | null | undefined): string {
  const e = normalizeEmail(value ?? "");
  if (!e || !e.includes("@")) return e ? "••••" : "";
  const [user, domain] = e.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

/** Formats a stored phone number for display. */
export function formatPhone(value: string | null | undefined): string {
  const n = normalizePhone(value ?? "");
  if (!n) return "";
  if (n.startsWith("00966") && n.length === 15) {
    const local = `0${n.slice(5)}`;
    return `+966 ${local.slice(1, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (n.length === 10 && n.startsWith("05")) {
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (n.length === 9 && n.startsWith("5")) return `5${n.slice(1, 4)} ${n.slice(4)}`;
  return n;
}

/** Turns "+9665xxxxxxxx" into the number wa.me expects. */
export function whatsappNumber(value: string | null | undefined): string {
  const n = normalizePhone(value ?? "");
  if (!n) return "";
  if (n.startsWith("00")) return n.slice(2);
  if (n.startsWith("+")) return n.slice(1);
  if (n.startsWith("0")) return `966${n.slice(1)}`;
  return n.replace(/\D/g, "");
}
