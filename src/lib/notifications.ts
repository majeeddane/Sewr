import { prisma } from "./prisma";
import { getSiteSettings } from "./settings";
import { formatPhone, maskEmail } from "./crypto";
import {
  bookingNotificationHtml,
  contactAutoReplyHtml,
  leadNotificationHtml,
  messageNotificationHtml,
  sendMail,
} from "./mailer";
import { logActivity } from "./activity";

/**
 * Ties together "persist the row" + "notify the team".
 * Notification failures never fail the request — the lead is already saved.
 */

function recipient(): string | null {
  return (
    process.env.NOTIFICATION_EMAIL ||
    process.env.SMTP_USER ||
    null
  );
}

/** Keeps notification payloads free of unnecessary personal data. */
function redact(phone: string): string {
  return formatPhone(phone);
}

export async function notifyNewClient(data: {
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  whoIsAsking: string;
  service: string;
  message?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    const settings = await getSiteSettings();
    if (!settings.notifyEmailEnabled || !settings.notifyOnNewClient) return;
    const to = settings.notificationEmail || recipient();
    if (!to) return;

    await sendMail({
      to,
      subject: `طلب استشارة جديد #${data.code} — ${data.name}`,
      html: leadNotificationHtml({
        code: data.code,
        name: data.name,
        phone: redact(data.phone),
        email: data.email ? maskEmail(data.email) : null,
        city: data.city,
        whoIsAsking: data.whoIsAsking,
        service: data.service,
        message: data.message,
      }),
    });
  } catch (error) {
    console.error("[notify] فشل إشعار العميل:", error);
  }
}

export async function notifyNewBooking(data: {
  code: string;
  name: string;
  phone: string;
  service: string;
  program?: string | null;
  date: string;
  time?: string | null;
  notes?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    const settings = await getSiteSettings();
    if (!settings.notifyEmailEnabled || !settings.notifyOnNewBooking) return;
    const to = settings.notificationEmail || recipient();
    if (!to) return;

    await sendMail({
      to,
      subject: `حجز استشارة جديد #${data.code} — ${data.name}`,
      html: bookingNotificationHtml({
        code: data.code,
        name: data.name,
        phone: redact(data.phone),
        service: data.service,
        program: data.program,
        date: data.date,
        time: data.time,
        notes: data.notes,
      }),
    });
  } catch (error) {
    console.error("[notify] فشل إشعار الحجز:", error);
  }
}

export async function notifyNewMessage(data: {
  name: string;
  phone: string;
  email?: string | null;
  subject?: string | null;
  topic?: string | null;
  message: string;
  ip?: string | null;
}): Promise<void> {
  try {
    const settings = await getSiteSettings();
    if (!settings.notifyEmailEnabled || !settings.notifyOnNewMessage) return;
    const to = settings.notificationEmail || recipient();
    if (!to) return;

    await sendMail({
      to,
      subject: `رسالة جديدة من ${data.name}`,
      html: messageNotificationHtml({
        name: data.name,
        phone: redact(data.phone),
        email: data.email,
        subject: data.subject,
        topic: data.topic,
        message: data.message,
      }),
    });
  } catch (error) {
    console.error("[notify] فشل إشعار الرسالة:", error);
  }

  // Auto-reply to the sender, when they left an e-mail address.
  if (data.email && data.email.includes("@")) {
    await sendMail({
      to: data.email,
      subject: "وصلتنا رسالتك — مركز سوار وعي",
      html: contactAutoReplyHtml(data.name),
    }).catch(() => {});
  }
}

/**
 * Publishes SCHEDULED posts whose time has arrived.
 * Call it from a cron route (`/api/cron/publish`) and opportunistically from
 * the blog index.
 */
export async function publishDuePosts(): Promise<number> {
  const now = new Date();
  const due = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, title: true },
  });

  for (const post of due) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
    });
    await logActivity({
      action: "PUBLISH",
      entity: "Post",
      entityId: post.id,
      summary: `نشر مجدول تلقائيًا: ${post.title}`,
    });
  }
  return due.length;
}
