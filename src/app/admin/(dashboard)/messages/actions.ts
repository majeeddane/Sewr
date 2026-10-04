"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sendMail } from "@/lib/mailer";
import { sanitizeText } from "@/lib/sanitize";
import { stripHtml } from "@/lib/utils";

/**
 * Inbox Server Actions.
 *
 * Every action repeats the same three guards before touching the database:
 *   1. an authenticated session,
 *   2. the capability the action needs,
 *   3. sanitised input.
 *
 * The inbox holds messages from people asking for addiction-recovery help, so
 * the decrypted fields never leave this module: client components only ever
 * receive plain strings that the page already authorised.
 */

export interface MessageActionResult {
  ok: boolean;
  message?: string;
}

export interface ReplyInput {
  id: string;
  to: string;
  subject: string;
  body: string;
}

const UNAUTHORIZED = "غير مصرّح.";
const NO_ACCESS = "لا تملك صلاحية الوصول إلى صندوق الرسائل.";

function fail(message: string): MessageActionResult {
  return { ok: false, message };
}

/** sanitizeText() flattens control characters (newlines included). */
function sanitizeMultiline(value: string | null | undefined, maxLength = 4000): string {
  if (!value) return "";
  return String(value)
    .split(/\r?\n/)
    .map((line) => sanitizeText(line, maxLength))
    .join("\n")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replyHtml(data: { name: string; subject: string; body: string }): string {
  const paragraphs = data.body
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  return `<!doctype html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f2ea;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2ea;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ece3d6;">
          <tr><td style="background:linear-gradient(135deg,#4B2A7B,#6b3fa0);padding:24px 28px;">
            <div style="color:#ffffff;font-size:20px;font-weight:700;">سوار وعي</div>
            <div style="color:#e8d9f5;font-size:13px;margin-top:4px;">مركز الإحاطة بعلوم التعافي</div>
          </td></tr>
          <tr><td style="padding:28px;color:#2b2233;direction:rtl;text-align:right;font-size:15px;line-height:1.9;">
            <h1 style="font-size:19px;margin:0 0 16px;color:#4B2A7B;">${escapeHtml(data.subject)}</h1>
            <p style="margin:0 0 14px;">مع السلامة ${escapeHtml(data.name)}،</p>
            ${paragraphs}
            <p style="color:#7a6f85;font-size:13px;margin-top:24px;">مع خالص التقدير،<br />فريق مركز سوار وعي</p>
          </td></tr>
          <tr><td style="background:#faf7f2;padding:18px 28px;color:#7a6f85;font-size:12px;line-height:1.8;border-top:1px solid #f0e8dc;">
           رد على رسالة وصلتك عبر نموذج «تواصل معنا» في الموقع.
            <br />سوار وعي — المملكة العربية السعودية
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// ── Flags ─────────────────────────────────────────────────────

/** Marks the message read — also fired automatically when a message is opened. */
export async function markRead(id: string): Promise<MessageActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "messages.view")) return fail(NO_ACCESS);

  const cleanId = String(id ?? "");
  if (!cleanId) return fail("معرّف الرسالة مطلوب.");

  const message = await prisma.contactMessage.findUnique({
    where: { id: cleanId },
    select: { id: true, isRead: true },
  });
  if (!message) return fail("الرسالة غير موجودة.");
  if (message.isRead) return { ok: true, message: "الرسالة مقروءة بالفعل." };

  await prisma.contactMessage.update({
    where: { id: cleanId },
    data: { isRead: true },
  });

  revalidatePath("/admin/messages");
  return { ok: true, message: "تم تعليم الرسالة كمقروءة." };
}

/** Puts the message back in the unread pile (follow-up pending). */
export async function markUnread(id: string): Promise<MessageActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "messages.view")) return fail(NO_ACCESS);

  const cleanId = String(id ?? "");
  if (!cleanId) return fail("معرّف الرسالة مطلوب.");

  const message = await prisma.contactMessage.findUnique({
    where: { id: cleanId },
    select: { id: true, isRead: true },
  });
  if (!message) return fail("الرسالة غير موجودة.");
  if (!message.isRead) return { ok: true, message: "الرسالة غير مقروءة بالفعل." };

  await prisma.contactMessage.update({
    where: { id: cleanId },
    data: { isRead: false },
  });

  revalidatePath("/admin/messages");
  return { ok: true, message: "تم تعليم الرسالة كغير مقروءة." };
}

/** Moves the message in and out of the archive; every change is audited. */
export async function toggleArchive(id: string): Promise<MessageActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "messages.view")) return fail(NO_ACCESS);

  const cleanId = String(id ?? "");
  if (!cleanId) return fail("معرّف الرسالة مطلوب.");

  const message = await prisma.contactMessage.findUnique({
    where: { id: cleanId },
    select: { id: true, name: true, isArchived: true },
  });
  if (!message) return fail("الرسالة غير موجودة.");

  const next = !message.isArchived;
  await prisma.contactMessage.update({
    where: { id: cleanId },
    data: { isArchived: next },
  });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "ContactMessage",
    entityId: message.id,
    summary: next
      ? `أرشفة رسالة: ${message.name}`
      : `إلغاء أرشفة رسالة: ${message.name}`,
    ip: clientIpFrom(hdrs),
  });

  revalidatePath("/admin/messages");
  return {
    ok: true,
    message: next ? "تم أرشفة الرسالة." : "تم إخراج الرسالة من الأرشيف.",
  };
}

/** Irreversible — only for spam and duplicates. */
export async function deleteMessage(id: string): Promise<MessageActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "messages.view")) return fail(NO_ACCESS);

  const cleanId = String(id ?? "");
  if (!cleanId) return fail("معرّف الرسالة مطلوب.");

  const message = await prisma.contactMessage.findUnique({
    where: { id: cleanId },
    select: { id: true, name: true, topic: true },
  });
  if (!message) return fail("الرسالة غير موجودة.");

  await prisma.contactMessage.delete({ where: { id: cleanId } });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "ContactMessage",
    entityId: message.id,
    summary: `حذف رسالة: ${message.name}${message.topic ? ` (${message.topic})` : ""}`,
    ip: clientIpFrom(hdrs),
  });

  revalidatePath("/admin/messages");
  return { ok: true, message: "تم حذف الرسالة نهائيًا." };
}

/**
 * Answers a visitor by e-mail.
 *
 * The body is rendered into a small RTL template, sent through the shared
 * mailer (which logs to the console when SMTP is not configured) and only then
 * stamped as replied + read.
 */
export async function replyToMessage(input: ReplyInput): Promise<MessageActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "messages.reply")) {
    return fail("لا تملك صلاحية الرد على الرسائل.");
  }

  const id = sanitizeText(input?.id, 60);
  const to = sanitizeText(input?.to, 160).toLowerCase();
  const subject = sanitizeText(input?.subject, 160);
  const body = sanitizeMultiline(input?.body, 4000);

  if (!id) return fail("معرّف الرسالة مطلوب.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return fail("البريد الإلكتروني للمُرسِل غير صالح — لا يمكن إرسال الرد.");
  }
  if (subject.length < 2) return fail("يرجى كتابة موضوع الرد.");
  if (body.length < 2) return fail("نص الرد فارغ.");

  const message = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!message) return fail("الرسالة غير موجودة.");

  const html = replyHtml({ name: message.name, subject, body });
  const result = await sendMail({
    to,
    subject,
    html,
    text: stripHtml(html),
    replyTo: user.email,
  });

  // `preview` means the mailer ran in development mode and logged the body
  // instead of delivering it — the reply still counts as handled there.
  if (!result.sent && !result.preview) {
    return fail(result.error ?? "تعذّر إرسال البريد الإلكتروني. تحقّق من إعدادات SMTP.");
  }

  await prisma.contactMessage.update({
    where: { id },
    data: { repliedAt: new Date(), isRead: true },
  });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "ContactMessage",
    entityId: message.id,
    summary: `الرد على رسالة: ${message.name}`,
    ip: clientIpFrom(hdrs),
  });

  revalidatePath("/admin/messages");
  return {
    ok: true,
    message: result.sent
      ? "تم إرسال الرد وتسجيله كمردّ."
      : "تم تسجيل الرد (وضع التطوير — البريد غير مُرسل فعليًا).",
  };
}