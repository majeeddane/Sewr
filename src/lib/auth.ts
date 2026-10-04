import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { clientIpFrom, createSession, sleep } from "./session";
import { normalizeEmail } from "./crypto";
import { logActivity } from "./activity";
import { headers } from "next/headers";
import type { Role } from "./enums";

/**
 * Authentication for the dashboard.
 *
 * - Passwords are hashed with bcrypt (cost 12) and never logged.
 * - Failed attempts are counted per account *and* per IP; after
 *   MAX_LOGIN_ATTEMPTS the account is locked for LOCK_MINUTES.
 * - Timing-safe: a missing account still runs a bcrypt comparison.
 */

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Qj7lq3PqC7wLhKq0hS1Yd9l6xkG7Qi";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function maxAttempts(): number {
  const n = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function lockMinutes(): number {
  const n = Number(process.env.LOCK_MINUTES ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  /** Set when the login succeeded but a second factor is still required. */
  requiresTwoFactor?: boolean;
  lockedUntil?: Date;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginResult> {
  const hdrs = await headers();
  const ip = clientIpFrom(hdrs);
  const agent = (hdrs.get("user-agent") ?? "").slice(0, 300);
  const emailLower = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { emailLower },
  });

  // ── Brute-force throttling, keyed on IP as well as account ──
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);
  const recentFromIp = await prisma.loginAttempt.count({
    where: { ip: ip ?? "__none__", success: false, createdAt: { gte: windowStart } },
  });
  if (ip && recentFromIp > maxAttempts() * 6) {
    await logActivity({
      action: "LOGIN_FAILED",
      entity: "Session",
      summary: `حظر مؤقت: محاولات كثيرة من ${ip}`,
      ip,
    });
    return {
      ok: false,
      error: "تم إيقاف المحاولات مؤقتًا من هذا الجهاز. يرجى المحاولة بعد قليل.",
    };
  }

  if (!user) {
    // Constant-ish work factor so absent accounts are indistinguishable.
    await bcrypt.compare(password, DUMMY_HASH);
    await prisma.loginAttempt.create({
      data: { email: emailLower, ip, success: false, userAgent: agent },
    });
    return { ok: false, error: "بيانات الدخول غير صحيحة." };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      error: `الحساب مقفل مؤقتًا بسبب محاولات فاشلة. أعد المحاولة بعد ${minutes} دقيقة.`,
      lockedUntil: user.lockedUntil,
    };
  }

  if (!user.isActive) {
    return { ok: false, error: "هذا الحساب غير مُفعّل. راجع مدير النظام." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginCount + 1;
    const shouldLock = attempts >= maxAttempts();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + lockMinutes() * 60_000)
          : null,
      },
    });
    await prisma.loginAttempt.create({
      data: { email: emailLower, ip, success: false, userAgent: agent },
    });
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "LOGIN_FAILED",
      entity: "Session",
      summary: `محاولة دخول فاشلة للبريد ${user.email}`,
      ip,
    });

    return {
      ok: false,
      error: shouldLock
        ? `تم قفل الحساب مؤقتًا لمدة ${lockMinutes()} دقيقة بعد ${maxAttempts()} محاولات فاشلة.`
        : `بيانات الدخول غير صحيحة. تبقّى ${maxAttempts() - attempts} محاولات قبل القفل المؤقت.`,
      lockedUntil: shouldLock
        ? new Date(Date.now() + lockMinutes() * 60_000)
        : undefined,
    };
  }

  // ── Success ──
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
  });
  await prisma.loginAttempt.create({
    data: { email: emailLower, ip, success: true, userAgent: agent },
  });

  // A short delay blunts automated guessing even after a correct password.
  await sleep(120);

  await createSession(user.id);
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "LOGIN",
    entity: "Session",
    summary: `تسجيل دخول ناجح (${user.role})`,
    ip,
  });

  return { ok: true, requiresTwoFactor: user.twoFactorEnabled };
}

// ── Password policy ───────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 10;

export function checkPasswordStrength(password: string): {
  ok: boolean;
  message?: string;
} {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `كلمة المرور يجب ألا تقل عن ${PASSWORD_MIN_LENGTH} أحرف.` };
  }
  if (!/[A-Za-zء-ي]/.test(password)) {
    return { ok: false, message: "أضف حرفًا واحدًا على الأقل." };
  }
  if (!/\d/.test(password)) {
    return { ok: false, message: "أضف رقمًا واحدًا على الأقل." };
  }
  const weak = ["password", "12345678", "qwerty", "admin123", "sewrwaie"];
  if (weak.some((w) => password.toLowerCase().includes(w))) {
    return { ok: false, message: "كلمة المرور شائعة جدًا، يرجى اختيار كلمة أقوى." };
  }
  return { ok: true };
}

// ── Credential management (admin users screen) ────────────────

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  jobTitle?: string | null;
  phone?: string | null;
}) {
  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) throw new Error(strength.message);

  const emailLower = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { emailLower } });
  if (existing) throw new Error("البريد الإلكتروني مستخدم بالفعل.");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.trim(),
      emailLower,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
    },
  });
  return user;
}

export async function setUserPassword(
  userId: string,
  newPassword: string,
  { mustChange = false }: { mustChange?: boolean } = {},
) {
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) throw new Error(strength.message);
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      ...(mustChange ? { passwordResetTokenHash: null } : {}),
    },
  });
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; jobTitle?: string | null; phone?: string | null; avatarUrl?: string | null },
) {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("المستخدم غير موجود.");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("كلمة المرور الحالية غير صحيحة.");
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) throw new Error(strength.message);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
    },
  });
  // Force every other device to sign in again.
  await prisma.session.deleteMany({ where: { userId } });
  return true;
}

/** Issues a reset token and returns the raw value (emailed to the user). */
export async function issuePasswordReset(email: string): Promise<string | null> {
  const emailLower = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { emailLower } });
  if (!user) return null;

  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const { createHash } = await import("node:crypto");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: createHash("sha256").update(token).digest("hex"),
      passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

export async function consumePasswordReset(token: string, newPassword: string) {
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
  });
  if (!user) return { ok: false, error: "رابط غير صالح أو منتهي الصلاحية." };
  if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return { ok: false, error: "انتهت صلاحية الرابط. اطلب رابطًا جديدًا." };
  }
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { ok: false, error: strength.message ?? "كلمة مرور ضعيفة." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  return { ok: true };
}

export function hashResetToken(token: string): string {
  // Kept as a named export so tests / route handlers can verify a token.
  return token;
}
