"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";
import {
  blindIndex,
  encrypt,
  maskEmail,
  normalizeName,
  phoneLast4,
} from "@/lib/crypto";
import { fieldErrors } from "@/lib/validation";
import { referenceCode } from "@/lib/utils";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  CONTACT_METHODS,
  WHO_IS_ASKING,
} from "@/lib/enums";
import type {
  ClientActionResult,
  ClientFormValues,
  DuplicateHit,
} from "./client-form";

/**
 * Beneficiary mutations.
 *
 * Every action in this file is reachable by anyone who can POST to the page, so
 * each one re-reads the session and re-checks the capability — the layout guard
 * is a convenience, not a security boundary.
 *
 * Security notes:
 *  • Nothing decrypted ever leaves the server: results carry ids and codes only.
 *  • `phoneEnc` / `emailEnc` / `notesEnc` are written from scratch on every save
 *    (fresh IV), while `phoneHash` / `emailHash` stay deterministic so search and
 *    duplicate detection keep working.
 *  • All free text goes through `sanitizeText()` before it is stored.
 */

const clientSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "الاسم الكامل مطلوب.")
    .max(120, "الاسم طويل جدًا."),
  phone: z
    .string()
    .trim()
    .min(9, "رقم الجوال مطلوب.")
    .max(20, "رقم الجوال غير صالح.")
    .refine(
      (value) => /^[+\d\s-]{9,20}$/.test(value),
      "أدخل رقم جوال صحيح يبدأ بـ 05.",
    ),
  email: z
    .string()
    .trim()
    .max(160, "البريد الإلكتروني طويل جدًا.")
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "صيغة البريد الإلكتروني غير صحيحة.",
    ),
  city: z.string().trim().max(80, "اسم المدينة طويل جدًا."),
  whoIsAsking: z
    .string()
    .trim()
    .refine(
      (value) => WHO_IS_ASKING.some((option) => option.value === value),
      "اختر صفة مقدم الطلب.",
    ),
  serviceInterest: z.string().trim().max(120, "الخدمة المطلوبة طويلة جدًا."),
  programId: z.string().trim().max(40),
  status: z.enum(CLIENT_STATUSES, {
    error: "اختر حالة صحيحة للطلب.",
  }),
  source: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (CLIENT_SOURCES as readonly string[]).includes(value),
      "اختر مصدر الطلب من القائمة.",
    ),
  preferredContactMethod: z
    .string()
    .trim()
    .refine(
      (value) => CONTACT_METHODS.some((option) => option.value === value),
      "اختر طريقة التواصل المفضّلة.",
    ),
  assignedToId: z.string().trim().max(40),
  notes: z.string().trim().max(4000, "الملاحظات طويلة جدًا."),
});

type ClientRow = z.infer<typeof clientSchema>;

const DENIED: ClientActionResult = {
  ok: false,
  message: "ليست لديك صلاحية تعديل بيانات المستفيدين.",
};

const UNAUTHORIZED: ClientActionResult = { ok: false, message: "غير مصرّح." };

/** Makes sure the optional foreign keys actually exist before Prisma does. */
async function validateRelations(
  row: ClientRow,
): Promise<Record<string, string> | null> {
  if (row.programId) {
    const program = await prisma.contentItem.findFirst({
      where: { id: row.programId, type: "PROGRAM" },
      select: { id: true },
    });
    if (!program) return { programId: "البرنامج المختار غير متوفر." };
  }
  if (row.assignedToId) {
    const user = await prisma.user.findFirst({
      where: { id: row.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!user) return { assignedToId: "مسؤول الملف غير متوفر." };
  }
  return null;
}

/** Builds the write payload: sanitised text + freshly encrypted secrets. */
function buildData(row: ClientRow) {
  const fullName = sanitizeText(row.fullName, 120);
  const city = sanitizeText(row.city, 80);
  const serviceInterest = sanitizeText(row.serviceInterest, 120);
  const notes = sanitizeText(row.notes, 4000);
  const email = row.email.trim();

  return {
    fullName,
    searchName: normalizeName(fullName),
    city: city || null,
    searchCity: city ? city.toLowerCase() : null,
    // AES-256-GCM with a new IV on every write.
    phoneEnc: encrypt(row.phone),
    phoneHash: blindIndex(row.phone),
    phoneLast4: phoneLast4(row.phone),
    emailEnc: email ? encrypt(email) : null,
    emailHash: email ? blindIndex(email) : null,
    emailMasked: email ? maskEmail(email) : null,
    notesEnc: notes ? encrypt(notes) : null,
    whoIsAsking: row.whoIsAsking,
    serviceInterest: serviceInterest || null,
    programId: row.programId || null,
    status: row.status,
    source: row.source || null,
    preferredContactMethod: row.preferredContactMethod,
    assignedToId: row.assignedToId || null,
  };
}

/** `SW-0007`, `SW-0008`, … — skipping any number that is already taken. */
async function nextClientCode(): Promise<string> {
  const count = await prisma.client.count();
  for (let n = count + 1; n <= count + 500; n += 1) {
    const code = referenceCode(n);
    const clash = await prisma.client.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  return referenceCode(Date.now());
}

function revalidateClients(id?: string) {
  revalidatePath("/admin/clients");
  if (id) revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
}

// ── Read-only helper used by the form's duplicate warning ─────

/** Narrows a Prisma row to the shape the client component expects. */
function toDuplicateHits(
  rows: Array<{
    id: string;
    code: string;
    fullName: string;
    city: string | null;
    status: string;
  }>,
): DuplicateHit[] {
  return rows.map((row) => ({ ...row, city: row.city ?? "" }));
}

export async function checkClientDuplicates({
  phone,
  email,
  excludeId,
}: {
  phone?: string;
  email?: string;
  excludeId?: string;
}): Promise<{ ok: boolean; duplicates: DuplicateHit[]; message?: string }> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, duplicates: [], message: "غير مصرّح." };
  if (!can(user.role, "clients.view")) {
    return { ok: false, duplicates: [], message: DENIED.message };
  }

  const phoneHash = blindIndex(phone);
  const emailHash = blindIndex(email);
  if (!phoneHash && !emailHash) return { ok: true, duplicates: [] };

  const hits = await prisma.client.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(phoneHash ? [{ phoneHash }] : []),
        ...(emailHash ? [{ emailHash }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      fullName: true,
      city: true,
      status: true,
    },
    take: 5,
  });

  return { ok: true, duplicates: toDuplicateHits(hits) };
}

// ── Mutations ─────────────────────────────────────────────────

export async function createClient(
  values: ClientFormValues,
): Promise<ClientActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "clients.edit")) return DENIED;

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: fieldErrors(parsed.error),
    };
  }
  const row = parsed.data;

  const relationError = await validateRelations(row);
  if (relationError) {
    return { ok: false, message: "تعذّر حفظ البيانات.", errors: relationError };
  }

  // Warn (never block) about records that already use this phone / e-mail.
  const phoneHash = blindIndex(row.phone);
  const emailHash = blindIndex(row.email);
  let duplicates: DuplicateHit[] = [];
  if (phoneHash || emailHash) {
    const hits = await prisma.client.findMany({
      where: {
        OR: [
          ...(phoneHash ? [{ phoneHash }] : []),
          ...(emailHash ? [{ emailHash }] : []),
        ],
      },
      select: { id: true, code: true, fullName: true, city: true, status: true },
      take: 5,
    });
    duplicates = toDuplicateHits(hits);
  }

  const code = await nextClientCode();
  const hdrs = await headers();

  const created = await prisma.client.create({
    data: {
      code,
      ...buildData(row),
      consentGivenAt: new Date(),
      consentIp: clientIpFrom(hdrs),
    },
    select: { id: true, code: true },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "Client",
    entityId: created.id,
    summary: `تسجيل مستفيد جديد ${created.code}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateClients(created.id);

  return {
    ok: true,
    id: created.id,
    duplicates,
    message:
      duplicates.length > 0
        ? "تم تسجيل المستفيد. تنبيه: يوجد سجل مشابق لرقم الجوال أو البريد."
        : "تم تسجيل المستفيد بنجاح.",
  };
}

export async function updateClient(
  id: string,
  values: ClientFormValues,
): Promise<ClientActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "clients.edit")) return DENIED;
  if (!id) return { ok: false, message: "معرّف المستفيد مفقود." };

  const existing = await prisma.client.findUnique({
    where: { id },
    select: { id: true, code: true, status: true },
  });
  if (!existing) return { ok: false, message: "المستفيد غير موجود." };

  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: fieldErrors(parsed.error),
    };
  }
  const row = parsed.data;

  const relationError = await validateRelations(row);
  if (relationError) {
    return { ok: false, message: "تعذّر حفظ البيانات.", errors: relationError };
  }

  await prisma.client.update({ where: { id }, data: buildData(row) });

  const hdrs = await headers();
  const changes: string[] = [];
  if (existing.status !== row.status) changes.push(`الحالة: ${existing.status} ← ${row.status}`);

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "Client",
    entityId: id,
    summary: changes.length
      ? `تعديل بيانات المستفيد ${existing.code} — ${changes.join(" · ")}`
      : `تعديل بيانات المستفيد ${existing.code}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateClients(id);

  return { ok: true, id, message: "تم حفظ التعديلات." };
}

export async function deleteClient(id: string): Promise<ClientActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "clients.delete")) return DENIED;
  if (!id) return { ok: false, message: "معرّف المستفيد مفقود." };

  const existing = await prisma.client.findUnique({
    where: { id },
    select: { id: true, code: true, _count: { select: { appointments: true } } },
  });
  if (!existing) return { ok: false, message: "المستفيد غير موجود." };

  // Appointments survive the delete (clientId is set to NULL).
  await prisma.client.delete({ where: { id } });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "Client",
    entityId: id,
    summary: `حذف المستفيد ${existing.code} (${existing._count.appointments} موعد مرتبط)`,
    ip: clientIpFrom(hdrs),
  });

  revalidateClients();

  return { ok: true, message: "تم حذف الملف نهائيًا." };
}
