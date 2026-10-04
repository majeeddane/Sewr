import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  Globe,
  KeyRound,
  Monitor,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_ACTION_LABELS,
  ENTITY_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
} from "@/lib/enums";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel } from "@/components/admin/widgets";
import { Badge } from "@/components/ui/primitives";
import { UserDetailActions, type AdminUserRow } from "../user-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملف المستخدم" };

/** Long agent strings are noise in a table; the head is what matters. */
function shortAgent(agent: string | null): string {
  if (!agent) return "غير معروف";
  const browser = /Chrome\/[\d.]+/i.exec(agent)?.[0];
  const platform = /Windows NT|Mac OS X|Android|iPhone OS|Linux/i.exec(agent)?.[0];
  return [browser?.replace(/\/[\d.]+$/, ""), platform].filter(Boolean).join(" · ") || agent.slice(0, 60);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-sand-200 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4 dark:border-white/10">
      <dt className="w-44 shrink-0 text-[0.8125rem] font-bold text-ink-500">{label}</dt>
      <dd className="min-w-0 text-[0.875rem] text-ink-800 dark:text-ink-200">{children}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user: viewer } = await getAuthContext();
  if (!viewer) redirect("/admin/login");
  if (!can(viewer.role, "users.view")) redirect("/admin");

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
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
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
      lastLoginIp: true,
      passwordChangedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!target) notFound();

  const [sessions, logs, superAdmins] = await Promise.all([
    prisma.session.findMany({
      where: { userId: target.id, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        lastSeenAt: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { userId: target.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
  ]);

  const row: AdminUserRow = {
    id: target.id,
    name: target.name,
    email: target.email,
    role: target.role as Role,
    jobTitle: target.jobTitle,
    phone: target.phone,
    isActive: target.isActive,
    lastLoginAt: target.lastLoginAt ? target.lastLoginAt.toISOString() : null,
    activeSessions: sessions.length,
    isLastSuperAdmin: target.role === "SUPER_ADMIN" && superAdmins <= 1,
  };

  const canEdit = can(viewer.role, "users.edit");
  const role = target.role as Role;
  const isLocked = Boolean(target.lockedUntil && target.lockedUntil > new Date());

  return (
    <>
      <AdminPageHeader
        title={target.name}
        description={ROLE_DESCRIPTIONS[role] ?? "حساب فريق لوحة التحكم."}
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/users", label: "المستخدمون" },
          { href: `/admin/users/${target.id}`, label: target.name },
        ]}
        action={
          <>
            <UserDetailActions user={row} canEdit={canEdit} currentUserId={viewer.id} />
            <Link
              href="/admin/users"
              className="inline-flex h-11 items-center rounded-full px-6 text-[0.9375rem] font-bold text-brand-800 transition-colors hover:bg-brand-50"
            >
              رجوع
            </Link>
          </>
        }
      />

      {row.isLastSuperAdmin && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl border border-warn-100 bg-warn-50 p-4 text-[0.8125rem] leading-relaxed text-warn-700 dark:border-warn-500/25 dark:bg-warn-500/10 dark:text-warn-500">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          هذا هو آخر مدير عام في النظام — لا يمكن تخفيض دوره أو تعطيله أو حذفه، حتى لا تُقفل لوحة
          التحكم على الجميع.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Identity */}
        <Panel title="بيانات الحساب" className="xl:col-span-2">
          <dl className="flex flex-col">
            <Row label="الاسم">{target.name}</Row>
            <Row label="البريد الإلكتروني">
              <span dir="ltr">{target.email}</span>
            </Row>
            <Row label="الدور">
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{ROLE_LABELS[role] ?? role}</Badge>
                <span dir="ltr" className="text-xs text-ink-400">
                  {role}
                </span>
              </span>
            </Row>
            <Row label="المسمى الوظيفي">{target.jobTitle ?? "—"}</Row>
            <Row label="رقم الجوال">
              {target.phone ? <span dir="ltr">{target.phone}</span> : "—"}
            </Row>
            <Row label="الحالة">
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={target.isActive ? "success" : "danger"}>
                  {target.isActive ? "مفعّل" : "معطّل"}
                </Badge>
                {isLocked && <Badge tone="warn">مقفل مؤقتًا</Badge>}
                {target.twoFactorEnabled && <Badge tone="info">تحقّق بخطوتين</Badge>}
              </span>
            </Row>
            <Row label="محاولات دخول فاشلة">
              {target.failedLoginCount}
              {isLocked && target.lockedUntil
                ? ` — يُفك القفل ${formatDateTime(target.lockedUntil)}`
                : ""}
            </Row>
            <Row label="آخر دخول">
              {target.lastLoginAt ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{formatDateTime(target.lastLoginAt)}</span>
                  <span className="text-xs text-ink-400">({timeAgo(target.lastLoginAt)})</span>
                  {target.lastLoginIp && (
                    <span dir="ltr" className="inline-flex items-center gap-1 text-xs text-ink-500">
                      <Globe className="size-3.5" aria-hidden />
                      {target.lastLoginIp}
                    </span>
                  )}
                </span>
              ) : (
                "لم يسجّل دخولًا بعد"
              )}
            </Row>
            <Row label="آخر تغيير لكلمة المرور">{formatDate(target.passwordChangedAt)}</Row>
            <Row label="تاريخ الإنشاء">{formatDateTime(target.createdAt)}</Row>
            <Row label="آخر تعديل">{formatDateTime(target.updatedAt)}</Row>
          </dl>
        </Panel>

        {/* Sessions */}
        <Panel
          title="الجلسات النشطة"
          description={`${sessions.length} جلسة مفتوحة الآن.`}
          padded={false}
        >
          {sessions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-500">
              لا توجد جلسات نشطة لهذا المستخدم.
            </p>
          ) : (
            <ul className="divide-y divide-sand-200 dark:divide-white/10">
              {sessions.map((session) => (
                <li key={session.id} className="px-5 py-3.5">
                  <p className="flex items-center gap-2 text-[0.8125rem] font-bold text-ink-800 dark:text-ink-200">
                    <Monitor className="size-3.5 text-brand-600" aria-hidden />
                    {shortAgent(session.userAgent)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                    {session.ip && (
                      <span dir="ltr" className="inline-flex items-center gap-1">
                        <Globe className="size-3" aria-hidden />
                        {session.ip}
                      </span>
                    )}
                    <span>بدأت {timeAgo(session.createdAt)}</span>
                    <span>آخر نشاط {timeAgo(session.lastSeenAt)}</span>
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-ink-400">
                    تنتهي {formatDateTime(session.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Activity */}
      <Panel
        title="آخر النشاطات"
        description="آخر 20 عملية مسجّلة باسم هذا المستخدم."
        className="mt-5"
        padded={false}
      >
        {logs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">لا يوجد نشاط مسجّل.</p>
        ) : (
          <ul className="divide-y divide-sand-200 dark:divide-white/10">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-500 dark:bg-white/10 dark:text-ink-300"
                >
                  <Activity className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] leading-snug text-ink-700 dark:text-ink-200">
                    {log.summary}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-ink-400">
                    <Badge tone="sand">
                      {ACTIVITY_ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                    <span>{ENTITY_LABELS[log.entity] ?? log.entity}</span>
                    <span>{formatDateTime(log.createdAt)}</span>
                    {log.ip && (
                      <span dir="ltr" className="inline-flex items-center gap-1">
                        <Globe className="size-3" aria-hidden />
                        {log.ip}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-400">
        <KeyRound className="size-3.5" aria-hidden />
        لا تُعرض كلمة المرور ولا بصمتها في أي مكان، ولا يمكن استرجاعها — فقط تعيين كلمة جديدة.
        <UserRound className="size-3.5" aria-hidden />
      </p>
    </>
  );
}