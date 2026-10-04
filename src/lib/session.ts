import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { can, type Permission } from "./rbac";
import type { Role } from "./enums";

/**
 * Opaque, server-side sessions.
 *
 * The cookie holds a random 32-byte token (httpOnly, sameSite=lax, secure in
 * production). Only its SHA-256 hash is stored, so a database leak cannot be
 * replayed as a login. Sessions expire both after a hard maximum age and after
 * a period of inactivity.
 */

export const SESSION_COOKIE = "sw_session";

function ttlMinutes(): number {
  const n = Number(process.env.SESSION_IDLE_MINUTES ?? 120);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

function maxAgeHours(): number {
  const n = Number(process.env.SESSION_MAX_AGE_HOURS ?? 24);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.startsWith("CHANGE_ME")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a real secret in production.");
    }
    return "dev-only-insecure-session-secret";
  }
  return s;
}

/** Signs the cookie value so a tampered cookie is rejected before any DB hit. */
function sign(token: string): string {
  return `${token}.${createHash("sha256").update(`${token}${secret()}`).digest("hex").slice(0, 32)}`;
}

function unsign(value: string): string | null {
  const idx = value.lastIndexOf(".");
  if (idx < 1) return null;
  const token = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHash("sha256")
    .update(`${token}${secret()}`)
    .digest("hex")
    .slice(0, 32);
  return sig === expected ? token : null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
}

export interface AuthContext {
  user: SessionUser | null;
  sessionId: string | null;
  /** True when the session existed but was idle-timed-out and has been cleared. */
  expired: boolean;
}

const ANONYMOUS: AuthContext = { user: null, sessionId: null, expired: false };

/**
 * Reads the current session. Also refreshes `lastSeenAt` and drops the cookie
 * when the session is no longer valid, which implements the idle logout.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return ANONYMOUS;

  const token = unsign(raw);
  if (!token) return ANONYMOUS;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return ANONYMOUS;

  const now = Date.now();
  if (session.expiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return { user: null, sessionId: null, expired: true };
  }

  if (now - session.lastSeenAt.getTime() > ttlMinutes() * 60_000) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return { user: null, sessionId: null, expired: true };
  }

  if (!session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return ANONYMOUS;
  }

  // Throttle the write: only touch once a minute.
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now) },
      })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    expired: false,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role as Role,
      jobTitle: session.user.jobTitle,
      avatarUrl: session.user.avatarUrl,
      isActive: session.user.isActive,
      twoFactorEnabled: session.user.twoFactorEnabled,
      lastLoginAt: session.user.lastLoginAt,
    },
  };
}

/** Current user or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getAuthContext()).user;
}

/** True when the signed-in user holds the capability. */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return can(user?.role, permission);
}

/** Creates a session row and sets the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const hdrs = await headers();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxAgeHours() * 3_600_000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ip: clientIpFrom(hdrs),
      userAgent: (hdrs.get("user-agent") ?? "").slice(0, 300),
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeHours() * 3600,
  });
}

/** Destroys the current session (single device). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    const token = unsign(raw);
    if (token) {
      await prisma.session
        .deleteMany({ where: { tokenHash: hashToken(token) } })
        .catch(() => {});
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** Destroys every session for a user (used after a password change). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  await destroySession();
}

/** Best-effort client IP from proxy headers. */
export function clientIpFrom(hdrs: Headers): string | null {
  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 60);
  return hdrs.get("x-real-ip")?.slice(0, 60) ?? null;
}

/** Blocking delays used by the login throttle. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
