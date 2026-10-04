import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Check, Search, ShieldCheck, Users as UsersIcon } from "lucide-react";

import { getAuthContext } from "@/lib/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/crypto";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/enums";
import { AdminPageHeader } from "@/components/admin/shell";
import { DataTable, Pagination, Panel, StatCard, type Column } from "@/components/admin/widgets";
import { Input, Select } from "@/components/ui/form";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { UsersManager, type AdminUserRow } from "./user-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المستخدمون" };

const PAGE_SIZE = 25;

const PERMISSION_LABELS: Record<string, string> = {
  "clients.view": "عرض المستفيدين",
  "clients.edit": "تعديل المستفيدين",
  "clients.delete": "حذف المستفيدين",
  "clients.export": "تصدير المستفيدين",
  "appointments.view": "عرض المواعيد",
  "appointments.edit": "تعديل المواعيد",
  "messages.view": "عرض الرسائل",
  "messages.reply": "الرد على الرسائل",
  "content.view": "عرض المحتوى",
  "content.edit": "تعديل المحتوى",
  "posts.edit": "تحرير المدونة",
  "media.view": "عرض مكتبة الوسائط",
  "media.upload": "رفع الوسائط",
  "media.delete": "حذف الوسائط",
  "settings.view": "عرض إعدادات الموقع",
  "settings.edit": "تعديل إعدادات الموقع",
  "users.view": "عرض المستخدمين",
  "users.edit": "إدارة المستخدمين",
  "activity.view": "عرض سجل النشاط",
};

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "users.view")) redirect("/admin");

  const sp = await searchParams;
  const q = asString(sp.q).trim();
  const roleFilter = asString(sp.role);
  const statusFilter = asString(sp.status);
  const page = Math.max(1, Number(asString(sp.page)) || 1);

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { emailLower: { contains: normalizeEmail(q) } },
    ];
  }
  if ((ROLES as readonly string[]).includes(roleFilter)) {
    where.role = roleFilter;
  }
  if (statusFilter === "active") where.isActive = true;
  if (statusFilter === "inactive") where.isActive = false;

  const [total, rows, activeCount, inactiveCount, superAdmins, liveSessions] =
    await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ role: "asc" }, { name: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          jobTitle: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
        },
      }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
      prisma.session.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { userId: true },
      }),
    ]);

  const sessionCounts = new Map<string, number>();
  for (const session of liveSessions) {
    sessionCounts.set(session.userId, (sessionCounts.get(session.userId) ?? 0) + 1);
  }

  const tableRows: AdminUserRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    jobTitle: row.jobTitle,
    phone: row.phone,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    activeSessions: sessionCounts.get(row.id) ?? 0,
    isLastSuperAdmin: row.role === "SUPER_ADMIN" && superAdmins <= 1,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (next: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(next));
    return `/admin/users?${params.toString()}`;
  };

  const canEdit = can(user.role, "users.edit");

  // ── Permissions matrix ──────────────────────────────────
  const matrixRows = PERMISSIONS.map((permission) => ({
    permission,
    cells: ROLES.map((role) => (can(role, permission) ? "✓" : "—")),
  }));

  const matrixColumns: Column<(typeof matrixRows)[number]>[] = [
    {
      key: "permission",
      header: "الصلاحية",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-800 dark:text-ink-200">
            {PERMISSION_LABELS[row.permission] ?? row.permission}
          </span>
          <span dir="ltr" className="text-[0.6875rem] text-ink-400">
            {row.permission}
          </span>
        </div>
      ),
    },
    ...ROLES.map((role) => ({
      key: role,
      header: ROLE_LABELS[role],
      cell: (row: (typeof matrixRows)[number]) => {
        const allowed = row.cells[ROLES.indexOf(role)] === "✓";
        return (
          <span
            className={
              allowed
                ? "text-base font-extrabold text-success-600 dark:text-success-500"
                : "text-ink-300 dark:text-ink-600"
            }
            aria-label={allowed ? "مسموح" : "غير مسموح"}
          >
            {row.cells[ROLES.indexOf(role)]}
          </span>
        );
      },
    })),
  ];

  return (
    <>
      <AdminPageHeader
        title="المستخدمون"
        description="حسابات فريق لوحة التحكم. التفعيل والتعطيل وتغيير كلمة المرور تُنهي جلسات المستخدم على كل الأجهزة."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/users", label: "المستخدمون" },
        ]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
            <ShieldCheck className="size-4" aria-hidden />
            {superAdmins} مدير عام في النظام
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي الحسابات" value={total} icon={UsersIcon} />
        <StatCard label="حسابات مفعّلة" value={activeCount} icon={Check} tone="success" />
        <StatCard
          label="حسابات معطّلة"
          value={inactiveCount}
          icon={UsersIcon}
          tone="warn"
          hint="لا يستطيع صاحبها الدخول حتى يُفعَّل"
        />
      </div>

      {/* Filters */}
      <Panel
        title="تصفية"
        className="mt-5"
        description="بحث بالاسم أو البريد، مع تصفية حسب الدور والحالة."
        padded={false}
      >
        <form
          method="get"
          action="/admin/users"
          className="grid items-end gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="u-q" className="text-sm font-bold text-ink-800">
              بحث
            </label>
            <Input
              id="u-q"
              name="q"
              defaultValue={q}
              placeholder="الاسم أو البريد الإلكتروني"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="u-role" className="text-sm font-bold text-ink-800">
              الدور
            </label>
            <Select id="u-role" name="role" defaultValue={roleFilter}>
              <option value="">كل الأدوار</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="u-status" className="text-sm font-bold text-ink-800">
              الحالة
            </label>
            <Select id="u-status" name="status" defaultValue={statusFilter}>
              <option value="">الكل</option>
              <option value="active">مفعّل</option>
              <option value="inactive">معطّل</option>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" icon={Search} className="flex-1">
              تصفية
            </Button>
            {q || roleFilter || statusFilter ? (
              <ButtonLink variant="ghost" href="/admin/users" className="shrink-0">
                مسح
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Panel>

      <div className="mt-5">
        <UsersManager rows={tableRows} currentUserId={user.id} canEdit={canEdit} />
      </div>

      <div className="mt-4">
        <Pagination page={page} pageCount={pageCount} total={total} buildHref={buildHref} />
      </div>

      {/* Read-only permissions matrix */}
      <Panel
        title="مصفوفة الصلاحيات"
        description="مرجع للقراءة فقط — مصدر الحقيقة هو ملف rbac، ولا يمكن تعديله من هنا."
        className="mt-6"
        padded={false}
      >
        <div className="grid gap-4 border-b border-sand-200 p-5 dark:border-white/10 md:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role} className="flex flex-col gap-1">
              <p className="text-sm font-extrabold text-brand-900 dark:text-white">
                {ROLE_LABELS[role]}
              </p>
              <p className="text-[0.8125rem] leading-relaxed text-ink-500">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>
        <DataTable
          columns={matrixColumns}
          rows={matrixRows}
          getKey={(row) => row.permission}
          empty="لا توجد صلاحيات معرّفة."
        />
      </Panel>
    </>
  );
}