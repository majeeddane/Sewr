import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Slugs ─────────────────────────────────────────────────────

/**
 * Arabic-aware slug generator. Keeps Arabic letters (browsers and search
 * engines handle them fine) and strips punctuation/diacritics.
 */
export function slugify(input: string, fallback = "item"): string {
  const base = String(input ?? "")
    .trim()
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel) and tatweel.
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    // Unify Arabic letter variants (أ إ آ → ا, ى → ي, ة → ه).
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u064B-\u0652]/g, "")
    // Anything that is not a letter, digit, space, dash or underscore.
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || fallback;
}

/** Appends -2, -3, … until `exists(slug)` returns false. */
export async function uniqueSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>,
  fallback = "item",
): Promise<string> {
  const base = slugify(desired, fallback);
  if (!(await exists(base))) return base;
  for (let i = 2; i < 200; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// ── Dates ─────────────────────────────────────────────────────

const AR_LOCALE = "ar-SA-u-nu-latn-ca-gregory";

export function formatDate(
  value: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(AR_LOCALE, opts).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(
  value: Date | string | null | undefined,
): string {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

/** "منذ ٣ أيام" style relative label. */
export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `قبل ${months} شهر`;
  return `قبل ${Math.floor(months / 12)} سنة`;
}

/** YYYY-MM-DD in local time — the format <input type="date"> expects. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  const d = value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DDTHH:mm in local time — <input type="datetime-local"> expects. */
export function toDateTimeInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  const d = value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Builds a Date from a <input type="date"> value at midnight local time. */
export function fromDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Builds a Date from a <input type="datetime-local"> value. */
export function fromDateTimeInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Combines a date + "HH:mm" time string into one Date. */
export function combineDateAndTime(date: Date, time?: string | null): Date {
  if (!time) return date;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return date;
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
}

// ── Text helpers ──────────────────────────────────────────────

/** Strips HTML tags — used for excerpts, meta descriptions and search text. */
export function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max = 160): string {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

/** Rough Arabic-aware reading time (words / 200 wpm). */
export function readingMinutes(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function excerptFrom(html: string, max = 180): string {
  return truncate(html, max);
}

// ── JSON column helpers (schema stores JSON as text) ───────────

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

// ── Numbers ───────────────────────────────────────────────────

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(AR_LOCALE).format(value);
}

/** Pulls the leading number out of a stat value like "+500" or "90%". */
export function numericPart(value: string): number {
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function nonNumericPart(value: string): string {
  return String(value ?? "").replace(/-?\d+(\.\d+)?/g, "");
}

/** Reference code for a new client: SW-0007 */
export function referenceCode(n: number): string {
  return `SW-${String(n).padStart(4, "0")}`;
}

// ── Arrays ────────────────────────────────────────────────────

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
