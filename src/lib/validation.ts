import { z } from "zod";

/**
 * Shared validation for the public forms and every admin Server Action.
 * Zod gives us one schema that produces both the runtime check and the
 * TypeScript type, so forms and actions can never drift apart.
 */

// ── Primitives ────────────────────────────────────────────────

/** Saudi mobile: 05XXXXXXXX / +9665XXXXXXXX / 9665XXXXXXXX / 009665XXXXXXXX */
export const saudiPhone = z
  .string()
  .trim()
  .min(9, "رقم الجوال مطلوب.")
  .max(20, "رقم الجوال غير صالح.")
  .refine((value) => {
    const ascii = value
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
        const code = d.charCodeAt(0);
        return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
      })
      .replace(/[^\d+]/g, "");
    let digits = ascii;
    if (digits.startsWith("+966")) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith("00")) digits = `0${digits.slice(2)}`;
    else if (digits.startsWith("966") && digits.length > 10) digits = `0${digits.slice(3)}`;
    return /^05\d{8}$/.test(digits);
  }, "أدخل رقم جوال سعودي صحيح يبدأ بـ 05.");

export const emailField = z
  .string()
  .trim()
  .min(5, "البريد الإلكتروني مطلوب.")
  .max(160, "البريد الإلكتروني طويل جدًا.")
  .email("صيغة البريد الإلكتروني غير صحيحة.");

export const fullName = z
  .string()
  .trim()
  .min(3, "الاسم الكامل مطلوب.")
  .max(120, "الاسم طويل جدًا.");

export const consent = z
  .union([z.literal("on"), z.literal("true"), z.literal(true), z.literal("1")], {
    error: "يجب الموافقة على سياسة الخصوصية للمتابعة.",
  });

/**
 * Spam protection: a hidden field only a bot would fill in, plus a minimum
 * time-on-form heuristic is enforced server-side by the action.
 */
export const honeypot = z.string().max(0, "تم رفض الطلب كرسالة غير مرغوبة.").optional().or(z.literal(""));

// ── Contact form ──────────────────────────────────────────────

export const contactSchema = z.object({
  fullName,
  phone: saudiPhone,
  email: z.union([emailField, z.literal("")]).optional(),
  topic: z.string().trim().min(2, "يرجى اختيار سبب التواصل.").max(80),
  subject: z.string().trim().max(160, "الموضوع طويل جدًا.").optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "الرسالة قصيرة جدًا (10 أحرف على الأقل).")
    .max(4000, "الرسالة طويلة جدًا."),
  consent,
  // anti-spam
  website: z.string().max(0).optional().or(z.literal("")),
  formStartedAt: z.coerce.number().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

// ── Booking form ──────────────────────────────────────────────

export const bookingSchema = z.object({
  fullName,
  phone: saudiPhone,
  email: z.union([emailField, z.literal("")]).optional(),
  service: z.string().trim().min(2, "يرجى اختيار الخدمة المطلوبة.").max(120),
  programId: z.string().trim().optional().or(z.literal("")),
  preferredDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const max = new Date(today);
      max.setDate(max.getDate() + 180);
      return date >= today && date <= max;
    }, "اختر تاريخًا من اليوم حتى ٦ أشهر قادمة."),
  preferredTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت غير صالح.")
    .optional()
    .or(z.literal("")),
  preferredContactMethod: z.enum(["PHONE", "WHATSAPP", "EMAIL"]),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000, "الملاحظات طويلة جدًا.").optional().or(z.literal("")),
  consent,
  website: z.string().max(0).optional().or(z.literal("")),
  formStartedAt: z.coerce.number().optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;

// ── Form options ─────────────────────────────────────────────

/** Services offered in the public forms. Editable from the dashboard. */
export const SERVICE_INTERESTS = [
  "استشارة أولية للتقييم",
  "الرعاية النفسية والعلمية المتخصصة",
  "برنامج إعادة تأهيل",
  "إرشاد أسري أو زوجي",
  "برامج الوقاية والتوعية",
  "تدريب فريق العمل",
  "برنامج تأهيل في مؤسسة تعليمية",
  "أخرى",
] as const;

/** Why the visitor is writing. */
export const CONTACT_TOPICS = [
  "استفسار عن خدمة",
  "حجز استشارة",
  "استفسار عن برنامج",
  "تعاون مؤسسي أو تدريبي",
  "استفسار إعلامي",
  "اقتراح أو ملاحظة",
  "أخرى",
] as const;

// ── Helpers ───────────────────────────────────────────────────

export type FieldErrors = Record<string, string>;

/** Flattens a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** First human-readable error message. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "تعذّر التحقق من البيانات.";
}

/**
 * Time-on-form check: a genuine visitor needs at least a couple of seconds to
 * read and fill a form, bots submit instantly. Combined with the honeypot this
 * stops the vast majority of automated submissions without a captcha.
 */
export function looksAutomated(startedAt?: number): boolean {
  if (!startedAt || !Number.isFinite(startedAt)) return false;
  return Date.now() - startedAt < 1500;
}

/** reCAPTCHA v3 verification — only runs when keys are configured. */
export async function verifyRecaptcha(token?: string | null): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not enabled
  if (!token) return false;

  try {
    const res = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      },
    );
    const data = (await res.json()) as { success?: boolean; score?: number };
    return Boolean(data.success && (data.score ?? 0) >= 0.5);
  } catch {
    return false;
  }
}
