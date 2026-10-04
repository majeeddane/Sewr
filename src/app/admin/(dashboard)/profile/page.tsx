import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { BadgeCheck, Globe, KeyRound, LogIn, ShieldCheck, UserRound } from "lucide-react";

import { clientIpFrom, createSession, getAuthContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { changeOwnPassword, checkPasswordStrength, updateUserProfile } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/enums";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel } from "@/components/admin/widgets";
import { Badge } from "@/components/ui/primitives";
import { ProfileForms } from "@/components/admin/settings/profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملفي الشخصي" };

/**
 * ملفي الشخصي — بيانات الحساب وكلمة المرور.
 *
 * The role, the e-mail and the activation flag are deliberately read-only here:
 * changing a role is a `users.edit` operation on /admin/users, so nobody can
 * escalate by editing their own profile.
 */

type ProfileActionResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <span className="text-[0.9375rem] font-bold text-ink-800 dark:text-ink-200">
        {children}
      </span>
    </div>
  );
}

/** The name and the avatar live in the admin shell, so refresh it too. */
function revalidateProfileViews(): void {
  revalidatePath("/admin/profile");
  revalidatePath("/admin/users");
  revalidatePath("/admin", "layout");
}

export default async function AdminProfilePage() {
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      jobTitle: true,
      phone: true,
      avatarUrl: true,
      isActive: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      lastLoginIp: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  if (!record) redirect("/admin/login");

  // ── Update own details ────────────────────────────────────
  async function saveProfileAction(formData: FormData): Promise<ProfileActionResult> {
    "use server";
    const { user: actor } = await getAuthContext();
    if (!actor) return { ok: false, message: "غير مصرّح." };

    const name = sanitizeText(field(formData, "name"), 120);
    if (!name) {
      return {
        ok: false,
        message: "يرجى تصحيح الحقول المميّزة.",
        errors: { name: "الاسم مطلوب." },
      };
    }

    const jobTitle = sanitizeText(field(formData, "jobTitle"), 120) || null;
    const phone = sanitizeText(field(formData, "phone"), 40) || null;
    const avatarUrl = sanitizeText(field(formData, "avatarUrl"), 600) || null;

    await updateUserProfile(actor.id, { name, jobTitle, phone, avatarUrl });

    await logActivity({
      userId: actor.id,
      userName: name,
      action: "UPDATE",
      entity: "User",
      entityId: actor.id,
      summary: `تحديث الملف الشخصي: ${name}`,
      ip: clientIpFrom(await headers()),
    });

    revalidateProfileViews();
    return { ok: true, message: "تم حفظ بياناتك." };
  }

  // ── Change own password ───────────────────────────────────
  async function changePasswordAction(formData: FormData): Promise<ProfileActionResult> {
    "use server";
    const { user: actor } = await getAuthContext();
    if (!actor) return { ok: false, message: "غير مصرّح." };

    const currentPassword = field(formData, "currentPassword");
    const newPassword = field(formData, "newPassword");
    const confirmPassword = field(formData, "confirmPassword");

    if (!currentPassword) {
      return {
        ok: false,
        message: "يرجى تعبئة الحقول المطلوبة.",
        errors: { currentPassword: "كلمة المرور الحالية مطلوبة." },
      };
    }
    if (newPassword !== confirmPassword) {
      return {
        ok: false,
        message: "يرجى تصحيح الحقول المميّزة.",
        errors: { confirmPassword: "كلمتا المرور غير متطابقتين." },
      };
    }

    // Explicit policy check first, so the message is specific even before the
    // hash comparison inside changeOwnPassword runs.
    const strength = checkPasswordStrength(newPassword);
    if (!strength.ok) {
      return {
        ok: false,
        message: "يرجى تصحيح الحقول المميّزة.",
        errors: { newPassword: strength.message ?? "كلمة مرور ضعيفة." },
      };
    }

    try {
      await changeOwnPassword(actor.id, currentPassword, newPassword);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "تعذّر تغيير كلمة المرور.",
      };
    }

    // `changeOwnPassword` drops every session of the account — including this
    // one — so a fresh session is issued to keep the current device signed in.
    await createSession(actor.id);

    await logActivity({
      userId: actor.id,
      userName: actor.name,
      action: "RESET_PASSWORD",
      entity: "User",
      entityId: actor.id,
      summary: "تغيير كلمة المرور الشخصية — أُنهيت الجلسات على الأجهزة الأخرى",
      ip: clientIpFrom(await headers()),
    });

    revalidateProfileViews();
    return {
      ok: true,
      message: "تم تغيير كلمة المرور. بقيتَ مسجّل الدخول على هذا الجهاز فقط.",
    };
  }

  const sessions = await prisma.session.findMany({
    where: { userId: record.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, ip: true, lastSeenAt: true, createdAt: true },
  });

  const role = record.role as Role;

  return (
    <>
      <AdminPageHeader
        title="ملفي الشخصي"
        description="بياناتك في لوحة التحكم وكلمة المرور الخاصة بك. تغيير الدور أو البريد يتم من شاشة المستخدمين بواسطة مدير النظام."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/profile", label: "ملفي الشخصي" },
        ]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
            <ShieldCheck className="size-4" aria-hidden />
            {ROLE_LABELS[role] ?? role}
          </span>
        }
      />

      {/* Read-only identity */}
      <Panel
        title="بيانات الحساب"
        description="حقول للعرض فقط — لتغيير الدور أو البريد راجع مدير النظام."
        className="mb-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="الاسم">
            <span className="flex items-center gap-2">
              <UserRound className="size-4 text-brand-600" aria-hidden />
              {record.name}
            </span>
          </Info>
          <Info label="البريد الإلكتروني">
            <span dir="ltr" className="block truncate">
              {record.email}
            </span>
          </Info>
          <Info label="الدور">
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{ROLE_LABELS[role] ?? role}</Badge>
              {!record.isActive && <Badge tone="danger">معطّل</Badge>}
              {record.twoFactorEnabled && <Badge tone="info">تحقّق بخطوتين</Badge>}
            </span>
          </Info>
          <Info label="آخر دخول">
            <span className="flex flex-col">
              <span className="flex items-center gap-2">
                <LogIn className="size-4 text-brand-600" aria-hidden />
                {record.lastLoginAt ? timeAgo(record.lastLoginAt) : "—"}
              </span>
              {record.lastLoginAt && (
                <span className="text-[0.6875rem] font-medium text-ink-400">
                  {formatDateTime(record.lastLoginAt)}
                  {record.lastLoginIp && (
                    <span dir="ltr" className="inline-flex items-center gap-1">
                      <Globe className="size-3" aria-hidden />
                      {record.lastLoginIp}
                    </span>
                  )}
                </span>
              )}
            </span>
          </Info>
          <Info label="تاريخ الانضمام">{formatDate(record.createdAt)}</Info>
          <Info label="آخر تغيير لكلمة المرور">{formatDate(record.passwordChangedAt)}</Info>
          <Info label="الجلسات النشطة">{sessions.length}</Info>
          <Info label="وصف الدور">{ROLE_DESCRIPTIONS[role] ?? "—"}</Info>
        </div>
      </Panel>

      {/* Editable */}
      <ProfileForms
        profile={{
          name: record.name,
          jobTitle: record.jobTitle,
          phone: record.phone,
          avatarUrl: record.avatarUrl,
        }}
        onSaveProfile={saveProfileAction}
        onChangePassword={changePasswordAction}
      />

      {/* Sessions */}
      <Panel
        title="أجهزتك المسجّلة الدخول"
        description="كل جهاز مفتوح بجلستك حاليًا. تغيير كلمة المرور يُنهيها جميعًا."
        className="mt-5"
        padded={false}
      >
        <ul className="divide-y divide-sand-200 dark:divide-white/10">
          {sessions.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-ink-500">
              لا توجد جلسات نشطة.
            </li>
          )}
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <span className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-800 dark:text-ink-200">
                <LogIn className="size-4 text-brand-600" aria-hidden />
                {session.ip ? <span dir="ltr">{session.ip}</span> : "جهاز غير معروف"}
              </span>
              <span className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                <span>بدأت {timeAgo(session.createdAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  آخر نشاط {timeAgo(session.lastSeenAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <KeyRound className="size-3.5" aria-hidden />
        لا يمكن استرجاع كلمة المرور — فقط تعيين كلمة مرور جديدة.
      </p>
    </>
  );
}