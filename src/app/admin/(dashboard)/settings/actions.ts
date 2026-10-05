"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";
import { sendMail } from "@/lib/mailer";
import { SOCIAL_KEYS } from "@/components/site/social-icons";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  settingsTabLabel,
  type SettingsTabKey,
} from "@/components/admin/settings/constants";

/**
 * Server Actions behind /admin/settings.
 *
 * Every action:
 *   1. re-reads the session (never trusts the client),
 *   2. checks the `settings.edit` capability,
 *   3. writes through an explicit per-tab whitelist — a stray field in the
 *      FormData can never reach the database,
 *   4. sanitises free text and logs to the audit trail,
 *   5. revalidates the admin screen *and* the public pages that render
 *      header / footer / hero.
 */

export interface SettingsActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

// ── Per-tab whitelists ────────────────────────────────────────

/** Free-text columns, written as strings. */
const TEXT_FIELDS: Record<SettingsTabKey, readonly string[]> = {
  identity: ["siteName", "siteNameEn", "tagline", "logoAlt"],
  contact: [
    "phone",
    "whatsapp",
    "whatsappMessage",
    "email",
    "address",
    "city",
    "country",
    "mapEmbedUrl",
    "mapLinkUrl",
  ],
  hours: [],
  social: [],
  home: [
    "heroBadge",
    "heroTitle",
    "heroDescription",
    "heroImageAlt",
    "homeAboutTitle",
    "homeAboutText",
    "homeAboutImageAlt",
    "homeServicesTitle",
    "homeServicesText",
    "homeServicesCtaText",
    "homeProgramsTitle",
    "homeProgramsText",
    "homeBlogTitle",
    "homeBlogText",
    "homeTestimonialsTitle",
    "homeFaqTitle",
    "homeFaqText",
    "finalCtaBadge",
    "finalCtaTitle",
    "finalCtaText",
  ],
  about: [
    "aboutHeroTitle",
    "aboutHeroText",
    "aboutWhoTitle",
    "aboutWhoText",
    "aboutVisionTitle",
    "aboutVisionText",
    "aboutMissionTitle",
    "aboutMissionText",
    "aboutValuesTitle",
    "aboutValuesText",
    "aboutVision2030Title",
    "aboutVision2030Text",
    "aboutWhyTitle",
    "aboutWhyText",
  ],
  seo: ["seoTitle", "seoDescription", "seoKeywords", "analyticsCode"],
  notify: ["notificationEmail"],
  appearance: [],
};

/** Image columns: an empty string means "cleared" → stored as NULL. */
const IMAGE_FIELDS: Record<SettingsTabKey, readonly string[]> = {
  identity: ["logoPath", "faviconPath"],
  contact: [],
  hours: [],
  social: [],
  home: ["heroImage", "homeAboutImage"],
  about: ["aboutVision2030Image"],
  seo: ["ogImage"],
  notify: [],
  appearance: [],
};

/** Checkbox columns: present = on, absent = off. */
const BOOL_FIELDS: Record<SettingsTabKey, readonly string[]> = {
  identity: ["blockAdminIndex", "logoIncludesName"],
  contact: [],
  hours: [],
  social: [],
  home: [],
  about: [],
  seo: [],
  notify: [
    "notifyEmailEnabled",
    "notifyOnNewClient",
    "notifyOnNewMessage",
    "notifyOnNewBooking",
  ],
  appearance: [],
};

/** Brand colours live in the appearance tab and are validated separately. */
const COLOR_FIELDS = ["primaryColor", "accentColor"] as const;

/** Notification switches never make a useful audit summary on their own. */
const SWITCH_ONLY_FIELDS = [
  "notifyEmailEnabled",
  "notifyOnNewClient",
  "notifyOnNewMessage",
  "notifyOnNewBooking",
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ───────────────────────────────────────────────────

function raw(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

/** Generous limits per column so a long paragraph is never truncated silently. */
function limitFor(field: string): number {
  if (field === "analyticsCode") return 8000;
  if (/(Text|Description|Message|address|Url)$/.test(field)) return 2000;
  if (field === "tagline") return 300;
  if (field === "siteNameEn") return 120;
  if (field === "siteName") return 160;
  return 200;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The settings singleton feeds the header, the footer and the hero, so every
 * mutation must refresh the public pages too — including the root layout.
 */
function revalidateAllSettingsViews(): void {
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/", "layout");
}

function unauthorized(): SettingsActionResult {
  return { ok: false, message: "غير مصرّح." };
}

function forbidden(): SettingsActionResult {
  return { ok: false, message: "لا تملك صلاحية تعديل إعدادات الموقع." };
}

function isTab(value: string): value is SettingsTabKey {
  return SETTINGS_TAB_KEYS_SET.has(value);
}

const SETTINGS_TAB_KEYS_SET = new Set<string>(
  Object.keys(TEXT_FIELDS),
);

// ── Save one tab ──────────────────────────────────────────────

export async function saveSettings(
  tab: string,
  formData: FormData,
): Promise<SettingsActionResult> {
  const { user } = await getAuthContext();
  if (!user) return unauthorized();
  if (!can(user.role, "settings.edit")) return forbidden();
  if (!isTab(tab)) return { ok: false, message: "قسم غير معروف." };

  const key = tab;
  const errors: Record<string, string> = {};
  const patch: Record<string, string | boolean | null> = {};

  // ── Free text ─────────────────────────────────────────────
  for (const field of TEXT_FIELDS[key]) {
    patch[field] = sanitizeText(raw(formData, field), limitFor(field));
  }

  // ── Images (an empty string clears the column) ────────────
  for (const field of IMAGE_FIELDS[key]) {
    patch[field] = emptyToNull(sanitizeText(raw(formData, field), 600));
  }

  // ── Checkboxes ────────────────────────────────────────────
  for (const field of BOOL_FIELDS[key]) {
    patch[field] = formData.has(field);
  }

  // ── Working-hours repeater → workingHoursJson ─────────────
  if (key === "hours") {
    const days = formData.getAll("hoursDay").map((v) => (typeof v === "string" ? v : ""));
    const values = formData.getAll("hoursValue").map((v) => (typeof v === "string" ? v : ""));
    const rows = days
      .map((day, index) => ({
        day: sanitizeText(day, 60),
        hours: sanitizeText(values[index] ?? "", 160),
      }))
      .filter((row) => row.day.length > 0)
      .slice(0, 7);
    patch.workingHoursJson = rows.length > 0 ? JSON.stringify(rows) : null;
  }

  // ── Social links → socialsJson ────────────────────────────
  if (key === "social") {
    const socials: Record<string, string> = {};
    for (const platform of SOCIAL_KEYS) {
      const value = sanitizeText(raw(formData, `social_${platform}`), 400);
      if (value) socials[platform] = value;
    }
    patch.socialsJson = Object.keys(socials).length > 0 ? JSON.stringify(socials) : null;
  }

  // ── Brand colours → primaryColor / accentColor ────────────
  if (key === "appearance") {
    for (const field of COLOR_FIELDS) {
      const value = sanitizeText(raw(formData, field), 7);
      if (!HEX.test(value)) {
        errors[field] = "أدخل لونًا بصيغة سداسية صحيحة مثل #4B2A7B.";
        continue;
      }
      patch[field] = value.toUpperCase();
    }
  }

  // ── Per-tab validation ────────────────────────────────────
  if (key === "identity" && !String(patch.siteName ?? "").trim()) {
    errors.siteName = "اسم الموقع مطلوب.";
  }
  if (key === "contact" && patch.email && !EMAIL_RE.test(String(patch.email).trim())) {
    errors.email = "صيغة البريد الإلكتروني غير صحيحة.";
  }
  if (key === "notify") {
    const mail = String(patch.notificationEmail ?? "").trim();
    if (patch.notifyEmailEnabled && !mail) {
      errors.notificationEmail = "أدخل البريد الذي تصلك عليه الإشعارات.";
    } else if (mail && !EMAIL_RE.test(mail)) {
      errors.notificationEmail = "صيغة البريد الإلكتروني غير صحيحة.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "يرجى تصحيح الحقول المميّزة.", errors };
  }

  // The singleton row self-heals if the seed has not run yet.
  const current = await getSiteSettings();
  await prisma.siteSetting.update({
    where: { id: current.id },
    data: patch as Prisma.SiteSettingUncheckedUpdateInput,
  });

  const contentFields = Object.keys(patch).filter((f) => !SWITCH_ONLY_FIELDS.includes(f));
  const summary =
    contentFields.length > 0
      ? `تعديل إعدادات الموقع — قسم ${settingsTabLabel(key)} (${contentFields.length} حقلًا)`
      : `تحديث مفاتيح الإشعارات — قسم ${settingsTabLabel(key)}`;

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "SETTINGS",
    entity: "SiteSetting",
    entityId: "singleton",
    summary,
    ip: clientIpFrom(await headers()),
  });

  revalidateAllSettingsViews();
  return { ok: true, message: `تم حفظ قسم ${settingsTabLabel(key)}.` };
}

// ── Reset the brand colours ──────────────────────────────────

export async function resetColors(): Promise<SettingsActionResult> {
  const { user } = await getAuthContext();
  if (!user) return unauthorized();
  if (!can(user.role, "settings.edit")) return forbidden();

  const current = await getSiteSettings();
  await prisma.siteSetting.update({
    where: { id: current.id },
    data: {
      primaryColor: DEFAULT_PRIMARY_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "SETTINGS",
    entity: "SiteSetting",
    entityId: "singleton",
    summary: `استعادة ألوان الهوية الافتراضية (${DEFAULT_PRIMARY_COLOR} / ${DEFAULT_ACCENT_COLOR})`,
    ip: clientIpFrom(await headers()),
  });

  revalidateAllSettingsViews();
  return { ok: true, message: "تمت استعادة الألوان الافتراضية." };
}

// ── Test the notification e-mail ─────────────────────────────

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function testEmailHtml(to: string): string {
  return `<!doctype html>
<html dir="rtl" lang="ar">
  <head><meta charset="utf-8" /><title>اختبار إعدادات البريد</title></head>
  <body style="margin:0;padding:24px;background:#f6f2ea;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ece3d6;border-radius:16px;overflow:hidden">
      <div style="background:#4B2A7B;padding:22px 26px;color:#fff;font-weight:700">سوار وعي</div>
      <div style="padding:26px;color:#2b2233;font-size:15px;line-height:1.9">
        <h1 style="font-size:19px;margin:0 0 14px;color:#4B2A7B">اختبار ناجح لإعدادات البريد</h1>
        <p>وصلتك هذه الرسالة من لوحة التحكم، أي أن إعدادات البريد تعمل بشكل صحيح.</p>
        <p style="background:#faf7f2;border-radius:12px;padding:12px 14px">الوجهة: <strong dir="ltr">${escapeHtml(to)}</strong></p>
      </div>
    </div>
  </body>
</html>`;
}

export async function testNotificationEmail(
  formData: FormData,
): Promise<SettingsActionResult> {
  const { user } = await getAuthContext();
  if (!user) return unauthorized();
  if (!can(user.role, "settings.edit")) return forbidden();

  const settings = await getSiteSettings();
  const typed = sanitizeText(raw(formData, "notificationEmail"), 200);
  const to = (typed || settings.notificationEmail || "").trim();

  if (!EMAIL_RE.test(to)) {
    return {
      ok: false,
      message: "أدخل بريدًا إلكترونيًا صحيحًا أولًا، ثم أعد المحاولة.",
      errors: { notificationEmail: "صيغة البريد الإلكتروني غير صحيحة." },
    };
  }

  const result = await sendMail({
    to,
    subject: "سوار وعي — اختبار إعدادات البريد",
    html: testEmailHtml(to),
    text: "اختبار ناجح لإعدادات البريد في سوار وعي.",
  });

  if (result.sent) {
    return { ok: true, message: `تم إرسال رسالة اختبار إلى ${to}.` };
  }

  if (!smtpConfigured()) {
    return {
      ok: false,
      message:
        "SMTP غير مُعد على الخادم (المتغيّران SMTP_HOST و SMTP_USER). سُجّلت الرسالة في سجل الخادم بدل إرسالها فعليًا.",
    };
  }

  return {
    ok: false,
    message: `تعذّر الإرسال عبر SMTP${result.error ? `: ${result.error}` : "."}`,
  };
}