"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  contactSchema,
  bookingSchema,
  fieldErrors,
  looksAutomated,
  verifyRecaptcha,
  type FieldErrors,
} from "@/lib/validation";
import {
  encrypt,
  blindIndex,
  normalizePhone,
  normalizeEmail,
  normalizeName,
  phoneLast4,
} from "@/lib/crypto";
import { referenceCode } from "@/lib/utils";
import { notifyNewBooking, notifyNewClient, notifyNewMessage } from "@/lib/notifications";
import { clientIpFrom } from "@/lib/session";
import { sanitizeText } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity";
import { getSiteSettings } from "@/lib/settings";

export interface FormResult {
  ok: boolean;
  message: string;
  errors?: FieldErrors;
}

/** Simple per-IP throttle so the forms cannot be used as a spam relay. */
async function tooManySubmissions(ip: string | null): Promise<boolean> {
  const limit = Number(process.env.FORM_RATE_LIMIT_PER_HOUR ?? 5);
  if (!Number.isFinite(limit) || limit <= 0 || !ip) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.contactMessage.count({
    where: { ip, createdAt: { gte: since } },
  });
  return recent >= limit;
}

/** Next sequential reference code, e.g. SW-0007. */
async function nextClientCode(): Promise<string> {
  const count = await prisma.client.count();
  for (let i = 0; i < 20; i += 1) {
    const candidate = referenceCode(count + 1 + i);
    const clash = await prisma.client.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;
  }
  return referenceCode(Date.now() % 100000);
}

// ═══════════════════════════════════════════════════════════════
//  Contact form
// ═══════════════════════════════════════════════════════════════

export async function submitContactForm(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const hdrs = await headers();
  const ip = clientIpFrom(hdrs);

  // Honeypot + minimum fill time + optional reCAPTCHA.
  if (looksAutomated(Number(formData.get("formStartedAt")))) {
    // Pretend it worked — bots learn nothing from an error message.
    return { ok: true, message: "وصلتنا رسالتك، شكرًا لك." };
  }
  if (!(await verifyRecaptcha(String(formData.get("recaptcha") ?? "")))) {
    return { ok: false, message: "تعذّر التحقق من الطلب. حاول مرة أخرى." };
  }
  if (await tooManySubmissions(ip)) {
    return {
      ok: false,
      message: "أرسلت عددًا كبيرًا من الرسائل خلال وقت قصير. يرجى المحاولة بعد قليل.",
    };
  }

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email ? normalizeEmail(data.email) : null;

  try {
    const message = await prisma.contactMessage.create({
      data: {
        name: sanitizeText(data.fullName, 120),
        phoneEnc: encrypt(phone),
        emailEnc: encrypt(email),
        phoneHash: blindIndex(phone),
        emailHash: email ? blindIndex(email) : null,
        subject: sanitizeText(data.subject, 160) || null,
        topic: sanitizeText(data.topic, 80),
        messageEnc: encrypt(String(data.message).slice(0, 4000)) ?? "",
        consentGivenAt: new Date(),
        ip,
        userAgent: (hdrs.get("user-agent") ?? "").slice(0, 300),
      },
    });

    await logActivity({
      action: "CREATE",
      entity: "ContactMessage",
      entityId: message.id,
      summary: `رسالة واردة من ${sanitizeText(data.fullName, 60)}`,
      ip,
    });

    await notifyNewMessage({
      name: data.fullName,
      phone,
      email,
      subject: data.subject || null,
      topic: data.topic,
      message: String(data.message).slice(0, 2000),
      ip,
    });

    return {
      ok: true,
      message: "وصلتنا رسالتك بنجاح. سيتواصل معك الفريق في أقرب وقت ممكن خلال ساعات العمل.",
    };
  } catch (error) {
    console.error("[contact] فشل الحفظ:", error);
    return {
      ok: false,
      message: "تعذّر إرسال الرسالة الآن. يرجى المحاولة بعد قليل أو الاتصال بنا مباشرة.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Booking form
// ═══════════════════════════════════════════════════════════════

export async function submitBookingForm(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const hdrs = await headers();
  const ip = clientIpFrom(hdrs);

  if (looksAutomated(Number(formData.get("formStartedAt")))) {
    return { ok: true, message: "تم استلام طلبك، شكرًا لك." };
  }
  if (!(await verifyRecaptcha(String(formData.get("recaptcha") ?? "")))) {
    return { ok: false, message: "تعذّر التحقق من الطلب. حاول مرة أخرى." };
  }
  if (await tooManySubmissions(ip)) {
    return {
      ok: false,
      message: "أرسلت عددًا كبيرًا من الطلبات خلال وقت قصير. يرجى المحاولة بعد قليل.",
    };
  }

  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email ? normalizeEmail(data.email) : null;
  const name = sanitizeText(data.fullName, 120);

  const preferredDate = new Date(`${data.preferredDate}T00:00:00`);
  if (Number.isNaN(preferredDate.getTime())) {
    return { ok: false, message: "التاريخ المفضّل غير صالح.", errors: { preferredDate: "اختر تاريخًا صحيحًا." } };
  }

  try {
    // 1. Create (or reuse) the beneficiary record.
    const phoneHash = blindIndex(phone);
    const emailHash = email ? blindIndex(email) : null;

    const existing = await prisma.client.findFirst({
      where: phoneHash ? { phoneHash } : { searchName: normalizeName(name) },
    });

    let clientId = existing?.id;
    let code = existing?.code;

    if (existing) {
      // Enrich the existing record without overwriting anything already known.
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          emailEnc: existing.emailEnc ?? encrypt(email),
          emailHash: existing.emailHash ?? emailHash,
          city: existing.city ?? (data.city || null),
          serviceInterest: data.service,
          status: existing.status === "NEW" ? "CONTACTED" : existing.status,
          preferredContactMethod: data.preferredContactMethod,
        },
      });
    } else {
      code = await nextClientCode();
      const created = await prisma.client.create({
        data: {
          code,
          fullName: name,
          searchName: normalizeName(name),
          phoneEnc: encrypt(phone),
          emailEnc: encrypt(email),
          phoneHash,
          emailHash,
          phoneLast4: phoneLast4(phone),
          city: data.city || null,
          searchCity: data.city ? data.city.toLowerCase() : null,
          whoIsAsking: "SELF",
          serviceInterest: sanitizeText(data.service, 120),
          programId: data.programId || null,
          status: "NEW",
          source: "الموقع الإلكتروني",
          preferredContactMethod: data.preferredContactMethod,
          notesEnc: encrypt(sanitizeText(data.notes, 2000) || null),
          consentGivenAt: new Date(),
          consentIp: ip,
        },
      });
      clientId = created.id;
    }

    // 2. Create the appointment.
    const program = data.programId
      ? await prisma.contentItem.findUnique({
          where: { type_slug: { type: "PROGRAM", slug: data.programId } },
          select: { id: true, title: true },
        })
      : null;

    await prisma.appointment.create({
      data: {
        clientId: clientId ?? null,
        clientName: name,
        service: sanitizeText(data.service, 120),
        programId: program?.id ?? null,
        preferredDate,
        preferredTime: data.preferredTime || null,
        status: "PENDING",
        notesEnc: encrypt(sanitizeText(data.notes, 2000) || null),
        channel: "BOOKING_FORM",
      },
    });

    await logActivity({
      action: "CREATE",
      entity: "Appointment",
      summary: `حجز جديد من الموقع — ${name}${code ? ` (#${code})` : ""}`,
      ip,
    });

    if (!existing) {
      await notifyNewClient({
        code: code ?? "—",
        name,
        phone,
        email,
        city: data.city || null,
        whoIsAsking: "عن نفسي",
        service: data.service,
        message: data.notes || null,
        ip,
      });
    }

    await notifyNewBooking({
      code: code ?? "—",
      name,
      phone,
      service: data.service,
      program: program?.title ?? null,
      date: data.preferredDate,
      time: data.preferredTime || null,
      notes: data.notes || null,
      ip,
    });

    return {
      ok: true,
      message: `تم استلام طلب الحجز${code ? ` برقم ${code}` : ""}. سنتواصل معك عبر ${
        data.preferredContactMethod === "WHATSAPP"
          ? "الواتساب"
          : data.preferredContactMethod === "EMAIL"
            ? "البريد الإلكتروني"
            : "الهاتف"
      } لتأكيد الموعد.`,
    };
  } catch (error) {
    console.error("[booking] فشل الحفظ:", error);
    return {
      ok: false,
      message:
        "تعذّر إتمام الحجز الآن. يرجى المحاولة بعد قليل أو الاتصال بنا مباشرة.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Newsletter (footer)
// ═══════════════════════════════════════════════════════════════

export async function subscribeToNewsletter(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    return { ok: false, message: "أدخل بريدًا إلكترونيًا صحيحًا." };
  }

  try {
    const existing = await prisma.contactMessage.findFirst({
      where: { emailHash: blindIndex(normalized), topic: "اشتراك النشرة" },
    });
    if (existing) {
      return { ok: true, message: "أنت مشترك في النشرة بالفعل. شكرًا لك." };
    }

    const settings = await getSiteSettings();
    await prisma.contactMessage.create({
      data: {
        name: "مشترك النشرة",
        emailEnc: encrypt(normalized),
        emailHash: blindIndex(normalized),
        subject: "اشتراك في نشرة سوار وعي",
        topic: "اشتراك النشرة",
        messageEnc: encrypt("اشتراك في النشرة البريدية.") ?? "",
        isRead: true,
        consentGivenAt: new Date(),
      },
    });

    await notifyNewMessage({
      name: "مشترك جديد في النشرة",
      phone: settings.phone ?? "—",
      email: normalized,
      subject: "اشتراك في النشرة",
      topic: "اشتراك النشرة",
      message: "طلب اشتراك في النشرة البريدية للمركز.",
    });

    return {
      ok: true,
      message: "تم تسجيل اشتراكك في نشرة سوار وعي. شكرًا لك.",
    };
  } catch (error) {
    console.error("[newsletter] فشل الاشتراك:", error);
    return { ok: false, message: "تعذّر إتمام الاشتراك الآن. حاول لاحقًا." };
  }
}
