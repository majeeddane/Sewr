import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound e-mail for lead / booking / inbox notifications.
 *
 * When SMTP is not configured (local development) messages are written to the
 * server console instead of being silently dropped, so the dashboard flow can
 * still be verified end-to-end.
 */

let transporter: Transporter | null = null;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function getTransporter(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export interface MailResult {
  sent: boolean;
  preview?: string;
  error?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const from =
    process.env.SMTP_FROM ??
    `سوار وعي <no-reply@${process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ?? "example.com"}>`;

  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        [
          "",
          "──────────── ✉️  بريد (وضع التطوير — SMTP غير مُعد) ────────────",
          `إلى:      ${input.to}`,
          `الموضوع:  ${input.subject}`,
          "",
          input.text ?? stripTags(input.html),
          "───────────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
      return { sent: false, preview: input.subject };
    }
    return { sent: false, error: "SMTP غير مُعد" };
  }

  try {
    await t.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripTags(input.html),
      replyTo: input.replyTo,
    });
    return { sent: true };
  } catch (error) {
    console.error("[mailer] فشل الإرسال:", error);
    return { sent: false, error: (error as Error).message };
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Templates ─────────────────────────────────────────────────

const shell = (title: string, body: string): string => `<!doctype html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
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
            <h1 style="font-size:19px;margin:0 0 16px;color:#4B2A7B;">${escapeHtml(title)}</h1>
            ${body}
          </td></tr>
          <tr><td style="background:#faf7f2;padding:18px 28px;color:#7a6f85;font-size:12px;line-height:1.8;border-top:1px solid #f0e8dc;">
            هذه رسالة نظامية تحتوي على بيانات شخصية حساسة. لا تشاركها ولا تنقلها خارج المركز.
            <br />سوار وعي — المملكة العربية السعودية
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rows(pairs: Array<[string, string | null | undefined]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    ${pairs
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(
        ([k, v]) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2ece2;color:#7a6f85;font-size:13px;width:150px;vertical-align:top;">${escapeHtml(k)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f2ece2;color:#2b2233;font-size:14px;font-weight:600;">${escapeHtml(String(v))}</td>
        </tr>`,
      )
      .join("")}
  </table>`;
}

export function leadNotificationHtml(data: {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  whoIsAsking: string;
  service: string;
  message?: string | null;
}): string {
  return shell(
    "طلب استشارة جديد من الموقع",
    `<p>وصل طلب جديد عبر نموذج الموقع. يمكنك مراجعته من لوحة التحكم.</p>
     ${rows([
       ["الرقم المرجعي", data.code],
       ["الاسم", data.name],
       ["الجوال", data.phone],
       ["البريد الإلكتروني", data.email],
       ["المدينة", data.city],
       ["صفة مقدم الطلب", data.whoIsAsking],
       ["الخدمة المطلوبة", data.service],
     ])}
     ${data.message ? `<h2 style="font-size:15px;margin:20px 0 6px;color:#4B2A7B;">الرسالة</h2><p style="background:#faf7f2;border-radius:12px;padding:14px 16px;margin:0;white-space:pre-wrap;">${escapeHtml(data.message)}</p>` : ""}`,
  );
}

export function bookingNotificationHtml(data: {
  code: string;
  name: string;
  phone: string;
  service: string;
  program?: string | null;
  date: string;
  time?: string | null;
  notes?: string | null;
}): string {
  return shell(
    "حجز استشارة جديد",
    `<p>حجز جديد عبر نموذج «احجز استشارة».</p>
     ${rows([
       ["الرقم المرجعي", data.code],
       ["الاسم", data.name],
       ["الجوال", data.phone],
       ["الخدمة", data.service],
       ["البرنامج", data.program],
       ["التاريخ المفضل", data.date],
       ["الوقت المفضل", data.time],
     ])}
     ${data.notes ? `<h2 style="font-size:15px;margin:20px 0 6px;color:#4B2A7B;">ملاحظات</h2><p style="background:#faf7f2;border-radius:12px;padding:14px 16px;margin:0;white-space:pre-wrap;">${escapeHtml(data.notes)}</p>` : ""}`,
  );
}

export function messageNotificationHtml(data: {
  name: string;
  phone: string;
  email?: string | null;
  subject?: string | null;
  topic?: string | null;
  message: string;
}): string {
  return shell(
    "رسالة جديدة عبر نموذج التواصل",
    `<p>وصلت رسالة جديدة من نموذج «تواصل معنا».</p>
     ${rows([
       ["الاسم", data.name],
       ["الجوال", data.phone],
       ["البريد الإلكتروني", data.email],
       ["الموضوع", data.subject],
       ["التصنيف", data.topic],
     ])}
     <h2 style="font-size:15px;margin:20px 0 6px;color:#4B2A7B;">نص الرسالة</h2>
     <p style="background:#faf7f2;border-radius:12px;padding:14px 16px;margin:0;white-space:pre-wrap;">${escapeHtml(data.message)}</p>`,
  );
}

export function passwordResetHtml(name: string, link: string): string {
  return shell(
    "إعادة تعيين كلمة المرور",
    `<p>مرحبًا ${escapeHtml(name)}،</p>
     <p>وصلنا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك في لوحة تحكم سوار وعي.</p>
     <p style="margin:24px 0;">
       <a href="${escapeHtml(link)}" style="background:#4B2A7B;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block;font-weight:700;">تعيين كلمة مرور جديدة</a>
     </p>
     <p style="color:#7a6f85;font-size:13px;">الرابط صالح لمدة ساعة واحدة فقط. إذا لم تطلب هذا الإجراء فتجاهل هذه الرسالة.</p>`,
  );
}

export function contactAutoReplyHtml(name: string): string {
  return shell(
    "وصلتنا رسالتك",
    `<p>مرحبًا ${escapeHtml(name)}،</p>
     <p>شكرًا لتواصلك مع مركز سوار وعي. وصلتنا رسالتك وسيتواصل معك فريقنا في أقرب وقت ممكن خلال ساعات العمل.</p>
     <p>إذا كان الأمر متعلقًا بحالة تحتاج تدخلًا عاجلًا، ننصحك بالاتصال بنا مباشرة على الرقم المعلن في الموقع.</p>
     <p style="color:#7a6f85;font-size:13px;margin-top:24px;">مع خالص التقدير،<br />فريق مركز سوار وعي</p>`,
  );
}
