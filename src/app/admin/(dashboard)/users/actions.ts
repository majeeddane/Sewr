"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAuthContext, clientIpFrom, createSession, destroyAllSessions } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";
import { normalizeEmail } from "@/lib/crypto";
import {
  checkPasswordStrength,
  createUser as createUserRecord,
  setUserPassword,
} from "@/lib/auth";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/enums";

/**
 * Server Actions behind /admin/users.
 *
 * Rules enforced on every mutation (defence in depth — the UI hides the same
 * options, but the action is the boundary):
 *   - only a role holding `users.edit` (SUPER_ADMIN) may run any of them,
 *   - nobody may change their own role, deactivate or delete themselves,
 *   - the last remaining SUPER_ADMIN may not be demoted, deactivated or deleted,
 *   - changing a password invalidates every session of that account,
 *   - passwords, hashes, 2FA secrets and reset tokens are never read, logged
 *     or returned.
 */

export interface UserActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, name: string, max = 120): string | null {
  return sanitizeText(field(formData, name), max) || null;
}

function parseRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

async function currentIp(): Promise<string | null> {
  return clientIpFrom(await headers());
}

/**
 * Counts **all** SUPER_ADMIN rows, active or not.
 *
 * Deliberately not "active super admins": deactivating the only active admin
 * would lock everyone out of the dashboard, so the last row must survive in
 * every form.
 */
async function superAdminCount(): Promise<number> {
  return prisma.user.count({ where: { role: "SUPER_ADMIN" } });
}

// ── Create ────────────────────────────────────────────────────

export async function createUserAction(formData: FormData): Promise<UserActionResult> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, message: "غير مصرّح." };
  if (!can(user.role, "users.edit")) {
    return { ok: false, message: "إنشاء المستخدمين متاح لمدير النظام فقط." };
  }

  const name = sanitizeText(field(formData, "name"), 120);
  const email = field(formData, "email");
  const role = parseRole(field(formData, "role"));
  const jobTitle = optionalText(formData, "jobTitle", 120);
  const phone = optionalText(formData, "phone", 40);
  const password = field(formData, "password");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "الاسم مطلوب.";
  if (!email) errors.email = "البريد الإلكتروني مطلوب.";
  else if (!EMAIL_RE.test(email)) errors.email = "صيغة البريد الإلكتروني غير صحيحة.";
  if (!role) errors.role = "اختر دورًا صالحًا.";
  if (!password) errors.password = "كلمة المرور مطلوبة.";
  else {
    const strength = checkPasswordStrength(password);
    if (!strength.ok) errors.password = strength.message ?? "كلمة مرور ضعيفة.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "يرجى تصحيح الحقول المميّزة.", errors };
  }

  try {
    const created = await createUserRecord({
      name,
      email,
      password,
      role: role as Role,
      jobTitle,
      phone,
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "User",
      entityId: created.id,
      summary: `إنشاء مستخدم جديد: ${created.name} (${ROLE_LABELS[created.role as Role] ?? created.role})`,
      ip: await currentIp(),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذّر إنشاء المستخدم.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/activity");
  return { ok: true, message: "تم إنشاء المستخدم." };
}

// ── Update ────────────────────────────────────────────────────

export async function updateUserAction(formData: FormData): Promise<UserActionResult> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, message: "غير مصرّح." };
  if (!can(user.role, "users.edit")) {
    return { ok: false, message: "تعديل المستخدمين متاح لمدير النظام فقط." };
  }

  const id = field(formData, "id");
  if (!id) return { ok: false, message: "معرّف المستخدم مفقود." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "المستخدم غير موجود." };

  const name = sanitizeText(field(formData, "name"), 120);
  const email = field(formData, "email");
  const role = parseRole(field(formData, "role"));
  const jobTitle = optionalText(formData, "jobTitle", 120);
  const phone = optionalText(formData, "phone", 40);

  const errors: Record<string, string> = {};
  if (!name) errors.name = "الاسم مطلوب.";
  if (!email) errors.email = "البريد الإلكتروني مطلوب.";
  else if (!EMAIL_RE.test(email)) errors.email = "صيغة البريد الإلكتروني غير صحيحة.";
  if (!role) errors.role = "اختر دورًا صالحًا.";

  if (email && normalizeEmail(email) !== target.emailLower) {
    const taken = await prisma.user.findUnique({
      where: { emailLower: normalizeEmail(email) },
    });
    if (taken && taken.id !== target.id) {
      errors.email = "البريد الإلكتروني مستخدم بالفعل.";
    }
  }

  // ── Self-protection ──────────────────────────────────────
  if (target.id === user.id && role !== target.role) {
    return { ok: false, message: "لا يمكنك تغيير دورك بنفسك. اطلب ذلك من مدير النظام." };
  }

  // ── The last SUPER_ADMIN ─────────────────────────────────
  if (
    target.role === "SUPER_ADMIN" &&
    role !== "SUPER_ADMIN" &&
    (await superAdminCount()) <= 1
  ) {
    return {
      ok: false,
      message: "لا يمكن تخفيض دور آخر مدير عام في النظام. أنشئ مديرًا عامًا آخر أولًا.",
    };
  }

  if (Object.keys(errors).length > 0 || !role) {
    return { ok: false, message: "يرجى تصحيح الحقول المميّزة.", errors };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      name,
      email,
      emailLower: normalizeEmail(email),
      role,
      jobTitle,
      phone,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "User",
    entityId: target.id,
    summary: `تعديل بيانات مستخدم: ${target.name} — ${target.email}`,
    ip: await currentIp(),
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/activity");
  return { ok: true, message: "تم حفظ بيانات المستخدم." };
}

// ── Password ──────────────────────────────────────────────────

export async function setUserPasswordAction(formData: FormData): Promise<UserActionResult> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, message: "غير مصرّح." };
  if (!can(user.role, "users.edit")) {
    return { ok: false, message: "تغيير كلمات المرور متاح لمدير النظام فقط." };
  }

  const id = field(formData, "id");
  const password = field(formData, "password");
  if (!id) return { ok: false, message: "معرّف المستخدم مفقود." };
  if (!password) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: { password: "كلمة المرور مطلوبة." },
    };
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    return {
      ok: false,
      message: "يرجى تصحيح الحقول المميّزة.",
      errors: { password: strength.message ?? "كلمة مرور ضعيفة." },
    };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "المستخدم غير موجود." };

  // `setUserPassword` hashes the value; the plain text never leaves this scope.
  await setUserPassword(target.id, password);

  // Every session of the target is dropped (forced sign-out), then the acting
  // admin gets a fresh session so the password change never logs *them* out.
  await destroyAllSessions(target.id);
  await createSession(user.id);

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "RESET_PASSWORD",
    entity: "User",
    entityId: target.id,
    summary: `تغيير كلمة مرور المستخدم: ${target.name} — أُنهيت جلساته النشطة`,
    ip: await currentIp(),
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/activity");
  return {
    ok: true,
    message: target.id === user.id
      ? "تم تغيير كلمة المرور. تم تسجيل خروج بقية الجلسات."
      : "تم تغيير كلمة المرور وإنهاء كل جلسات هذا المستخدم.",
  };
}

// ── Activate / deactivate ─────────────────────────────────────

export async function toggleUserActiveAction(formData: FormData): Promise<UserActionResult> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, message: "غير مصرّح." };
  if (!can(user.role, "users.edit")) {
    return { ok: false, message: "تفعيل الحسابات متاح لمدير النظام فقط." };
  }

  const id = field(formData, "id");
  const next = field(formData, "active") === "1";
  if (!id) return { ok: false, message: "معرّف المستخدم مفقود." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "المستخدم غير موجود." };

  if (!next && target.id === user.id) {
    return { ok: false, message: "لا يمكنك تعطيل حسابك بنفسك." };
  }

  if (!next && target.role === "SUPER_ADMIN" && (await superAdminCount()) <= 1) {
    return {
      ok: false,
      message: "لا يمكن تعطيل آخر مدير عام في النظام — ستُغلق لوحة التحكم بالكامل.",
    };
  }

  if (target.isActive === next) {
    return { ok: true, message: next ? "الحساب مفعّل بالفعل." : "الحساب معطّل بالفعل." };
  }

  await prisma.user.update({ where: { id: target.id }, data: { isActive: next } });

  // A disabled account must lose its sessions immediately. `destroyAllSessions`
  // is deliberately avoided here: it would also clear the acting admin cookie.
  if (!next) {
    await prisma.session.deleteMany({ where: { userId: target.id } });
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "User",
    entityId: target.id,
    summary: next ? `تفعيل حساب: ${target.name}` : `تعطيل حساب: ${target.name}`,
    ip: await currentIp(),
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath("/admin/activity");
  return { ok: true, message: next ? "تم تفعيل الحساب." : "تم تعطيل الحساب." };
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteUserAction(formData: FormData): Promise<UserActionResult> {
  const { user } = await getAuthContext();
  if (!user) return { ok: false, message: "غير مصرّح." };
  if (!can(user.role, "users.edit")) {
    return { ok: false, message: "حذف المستخدمين متاح لمدير النظام فقط." };
  }

  const id = field(formData, "id");
  if (!id) return { ok: false, message: "معرّف المستخدم مفقود." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, message: "المستخدم غير موجود." };

  if (target.id === user.id) {
    return { ok: false, message: "لا يمكنك حذف حسابك بنفسك." };
  }

  if (target.role === "SUPER_ADMIN" && (await superAdminCount()) <= 1) {
    return {
      ok: false,
      message: "لا يمكن حذف آخر مدير عام في النظام.",
    };
  }

  // Sessions cascade with the user row.
  await prisma.user.delete({ where: { id: target.id } });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "User",
    entityId: target.id,
    summary: `حذف مستخدم: ${target.name} — ${target.email}`,
    ip: await currentIp(),
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/activity");
  return { ok: true, message: "تم حذف المستخدم." };
}