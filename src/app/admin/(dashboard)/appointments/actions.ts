"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";
import { encrypt } from "@/lib/crypto";
import { fieldErrors } from "@/lib/validation";
import { fromDateInput } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  isAppointmentStatus,
} from "@/lib/enums";
import type {
  AppointmentActionResult,
  AppointmentFormValues,
} from "@/components/admin/appointments/appointment-list";

/**
 * Appointment mutations.
 *
 * Same contract as the beneficiaries actions: authenticate, authorise, validate,
 * sanitise, encrypt, audit, revalidate. `notesEnc` is re-encrypted with a fresh
 * IV on every write and is never returned to the caller.
 */

const CHANNELS = [
  "BOOKING_FORM",
  "RECEPTION",
  "PHONE",
  "WHATSAPP",
  "WALK_IN",
] as const;

const appointmentSchema = z
  .object({
    clientId: z.string().trim().max(40),
    clientName: z.string().trim().max(120),
    service: z
      .string()
      .trim()
      .min(2, "يرجى اختيار أو كتابة الخدمة المطلوبة.")
      .max(120, "اسم الخدمة طويل جدًا."),
    programId: z.string().trim().max(40),
    preferredDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح."),
    preferredTime: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        "الوقت غير صالح.",
      ),
    status: z.enum(APPOINTMENT_STATUSES, { error: "اختر حالة صحيحة للموعد." }),
    channel: z.enum(CHANNELS, { error: "اختر قناة صحيحة للموعد." }),
    notes: z.string().trim().max(2000, "الملاحظات طويلة جدًا."),
  })
  .refine(
    (row) => row.clientId !== "" || row.clientName.length >= 2,
    { message: "اكتب اسم العميل، أو اختر ملف مستفيد مسجّل.", path: ["clientName"] },
  );

type AppointmentRow = z.infer<typeof appointmentSchema>;

const UNAUTHORIZED: AppointmentActionResult = {
  ok: false,
  message: "غير مصرّح.",
};

const DENIED: AppointmentActionResult = {
  ok: false,
  message: "ليست لديك صلاحية إدارة المواعيد.",
};

async function validateRelations(
  row: AppointmentRow,
): Promise<Record<string, string> | null> {
  if (row.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: row.clientId },
      select: { id: true },
    });
    if (!client) return { clientId: "ملف المستفيد غير موجود." };
  }
  if (row.programId) {
    const program = await prisma.contentItem.findFirst({
      where: { id: row.programId, type: "PROGRAM" },
      select: { id: true },
    });
    if (!program) return { programId: "البرنامج المختار غير متوفر." };
  }
  return null;
}

function buildData(row: AppointmentRow) {
  const date = fromDateInput(row.preferredDate);
  return {
    clientId: row.clientId || null,
    clientName: row.clientId ? null : sanitizeText(row.clientName, 120) || null,
    service: sanitizeText(row.service, 120),
    programId: row.programId || null,
    preferredDate: date ?? new Date(),
    // Stored as free text ("09:30") to stay timezone-agnostic.
    preferredTime: row.preferredTime || null,
    status: row.status,
    channel: row.channel,
    notesEnc: row.notes.trim() ? encrypt(sanitizeText(row.notes, 2000)) : null,
  };
}

function revalidateAppointments(clientId?: string | null) {
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/clients");
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin");
}

// ── Mutations ─────────────────────────────────────────────────

export async function createAppointment(
  values: AppointmentFormValues,
): Promise<AppointmentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "appointments.edit")) return DENIED;

  const parsed = appointmentSchema.safeParse(values);
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
    return { ok: false, message: "تعذّر حفظ الموعد.", errors: relationError };
  }

  const created = await prisma.appointment.create({
    data: buildData(row),
    select: { id: true, clientId: true },
  });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "Appointment",
    entityId: created.id,
    summary: `حجز موعد ${row.preferredDate}${row.preferredTime ? ` الساعة ${row.preferredTime}` : ""} — ${row.service}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateAppointments(created.clientId);

  return { ok: true, id: created.id, message: "تم إنشاء الموعد." };
}

export async function updateAppointment(
  id: string,
  values: AppointmentFormValues,
): Promise<AppointmentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "appointments.edit")) return DENIED;
  if (!id) return { ok: false, message: "معرّف الموعد مفقود." };

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, clientId: true, status: true },
  });
  if (!existing) return { ok: false, message: "الموعد غير موجود." };

  const parsed = appointmentSchema.safeParse(values);
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
    return { ok: false, message: "تعذّر حفظ الموعد.", errors: relationError };
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: buildData(row),
    select: { clientId: true },
  });

  const hdrs = await headers();
  const changes: string[] = [];
  if (existing.status !== row.status) {
    changes.push(
      `الحالة: ${existing.status} ← ${row.status}`,
    );
  }
  if (existing.clientId !== updated.clientId) changes.push("تغيّر العميل");

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "Appointment",
    entityId: id,
    summary: changes.length
      ? `تعديل موعد ${row.preferredDate} — ${changes.join(" · ")}`
      : `تعديل موعد ${row.preferredDate}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateAppointments(existing.clientId ?? updated.clientId);

  return { ok: true, id, message: "تم حفظ الموعد." };
}

export async function updateAppointmentStatus(
  id: string,
  status: string,
): Promise<AppointmentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "appointments.edit")) return DENIED;
  if (!id) return { ok: false, message: "معرّف الموعد مفقود." };
  if (!isAppointmentStatus(status)) {
    return { ok: false, message: "حالة الموعد غير صالحة." };
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      status: true,
      preferredDate: true,
      service: true,
    },
  });
  if (!existing) return { ok: false, message: "الموعد غير موجود." };
  if (existing.status === status) {
    return { ok: true, id, message: "الموعد بحالته الحالية بالفعل." };
  }

  await prisma.appointment.update({ where: { id }, data: { status } });

  const hdrs = await headers();
  const label = APPOINTMENT_STATUS_LABELS[status];
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "Appointment",
    entityId: id,
    summary: `موعد ${existing.service}: ${existing.status} ← ${label}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateAppointments(existing.clientId);

  return { ok: true, id, message: `تم تحديث حالة الموعد إلى: ${label}` };
}

export async function deleteAppointment(id: string): Promise<AppointmentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return UNAUTHORIZED;
  if (!can(user.role, "appointments.edit")) return DENIED;
  if (!id) return { ok: false, message: "معرّف الموعد مفقود." };

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, clientId: true, service: true, preferredDate: true },
  });
  if (!existing) return { ok: false, message: "الموعد غير موجود." };

  await prisma.appointment.delete({ where: { id } });

  const hdrs = await headers();
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "Appointment",
    entityId: id,
    summary: `حذف موعد ${existing.service} بتاريخ ${existing.preferredDate.toISOString().slice(0, 10)}`,
    ip: clientIpFrom(hdrs),
  });

  revalidateAppointments(existing.clientId);

  return { ok: true, message: "تم حذف الموعد." };
}
