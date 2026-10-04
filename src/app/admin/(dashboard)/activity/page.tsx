import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Activity, Check, ListFilter, ScrollText } from "lucide-react";

import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { logActivity, pruneActivityLog } from "@/lib/activity";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_LABELS,
  ENTITY_LABELS,
} from "@/lib/enums";
import { formatDateTime, fromDateInput } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { DataTable, Pagination, Panel, StatCard, type Column } from "@/components/admin/widgets";
import { Input, Select } from "@/components/ui/form";
import { Badge, Button, ButtonLink, type BadgeTone } from "@/components/ui/primitives";
import {
  ActivityExportLink,
  CsvDownload,
  PruneActivityButton,
} from "@/components/admin/settings/activity-tools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "سجل النشاط" };

const PAGE_SIZE = 50;
/** Hard ceiling so a wildcard filter can never stream the whole table. */
const EXPORT_LIMIT = 5000;
const RETENTION_DAYS = 365;

const ACTION_TONES: Record<string, BadgeTone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "success",
  LOGOUT: "sand",
  LOGIN_FAILED: "warn",
  PUBLISH: "brand",
  UNPUBLISH: "warn",
  SCHEDULE: "gold",
  EXPORT: "gold",
  UPLOAD: "info",
  RESET_PASSWORD: "warn",
  SETTINGS: "brand",
};

type LogRow = {
  id: string;
  createdAt: Date;
  userName: string | null;
  action: string;
  entity: string;
  summary: string;
  ip: string | null;
};

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** RFC 4180 escaping — Arabic summaries often contain commas and quotes. */
function csvCell(value: string | null): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "activity.view")) redirect("/admin");

  const sp = await searchParams;
  const action = asString(sp.action);
  const entity = asString(sp.entity);
  const userId = asString(sp.user);
  const from = asString(sp.from);
  const to = asString(sp.to);
  const q = asString(sp.q).trim();
  const wantsExport = asString(sp.export) === "csv";
  const pruned = asString(sp.pruned) === "1" ? asString(sp.removed) : null;

  // ── Filters ────────────────────────────────────────────
  const where: Prisma.ActivityLogWhereInput = {};
  if ((ACTIVITY_ACTIONS as readonly string[]).includes(action)) where.action = action;
  if (Object.prototype.hasOwnProperty.call(ENTITY_LABELS, entity)) where.entity = entity;
  if (userId) where.userId = userId;
  if (q) where.summary = { contains: q };

  const fromDate = from ? fromDateInput(from) : null;
  const toDate = to ? fromDateInput(to) : null;
  if (fromDate || toDate) {
    const range: Prisma.DateTimeFilter = {};
    if (fromDate) range.gte = fromDate;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.createdAt = range;
  }

  const isFiltered = Boolean(action || entity || userId || from || to || q);

  const exportHref = (() => {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (userId) params.set("user", userId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    return `/admin/activity?${params.toString()}`;
  })();

  const listHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (userId) params.set("user", userId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    return `/admin/activity?${params.toString()}`;
  };

  // ── CSV export (same filters, no pagination) ───────────
  if (wantsExport) {
    const exportRows: LogRow[] = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      select: {
        id: true,
        createdAt: true,
        userName: true,
        action: true,
        entity: true,
        summary: true,
        ip: true,
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "EXPORT",
      entity: "ActivityLog",
      entityId: null,
      summary: `تصدير سجل النشاط (${exportRows.length} سجل${isFiltered ? " مع المرشّحات الحالية" : ""})`,
      ip: clientIpFrom(await headers()),
    });

    const header = ["الوقت", "المستخدم", "الإجراء", "الكيان", "التفاصيل", "IP"];
    const body = exportRows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.userName ?? "النظام",
        ACTIVITY_ACTION_LABELS[row.action] ?? row.action,
        ENTITY_LABELS[row.entity] ?? row.entity,
        row.summary,
        row.ip ?? "",
      ]
        .map(csvCell)
        .join(","),
    );

    // UTF-8 BOM so Excel renders the Arabic text correctly.
    const csv = `\uFEFF${[header.map(csvCell).join(","), ...body].join("\r\n")}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `sewr-waie-activity-${stamp}.csv`;

    return (
      <>
        <AdminPageHeader
          title="سجل النشاط"
          description="نسخة من السجل مطابقة للمرشّحات الحالية، بصيغة CSV جاهزة لإكسل."
          breadcrumb={[
            { href: "/admin", label: "لوحة التحكم" },
            { href: "/admin/activity", label: "سجل النشاط" },
          ]}
        />
        <CsvDownload csv={csv} filename={filename} total={exportRows.length} />
      </>
    );
  }

  // ── List view ──────────────────────────────────────────
  const page = Math.max(1, Number(asString(sp.page)) || 1);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [total, rows, users, todayCount, weekCount] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        userName: true,
        action: true,
        entity: true,
        summary: true,
        ip: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.activityLog.count({
      where: { createdAt: { gte: startOfToday } },
    }),
    prisma.activityLog.count({
      where: { createdAt: { gte: weekAgo } },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Prune (behind ConfirmButton) ──────────────────────
  async function pruneActivity(): Promise<{ ok: boolean; message?: string }> {
    "use server";
    const { user: actor } = await getAuthContext();
    if (!actor) return { ok: false, message: "غير مصرّح." };
    if (!can(actor.role, "activity.view")) {
      return { ok: false, message: "لا تملك صلاحية تنظيف السجل." };
    }

    const removed = await pruneActivityLog(RETENTION_DAYS);
    await logActivity({
      userId: actor.id,
      userName: actor.name,
      action: "DELETE",
      entity: "ActivityLog",
      entityId: null,
      summary: `تنظيف سجل النشاط الأقدم من ${RETENTION_DAYS} يومًا — حُذف ${removed} سجل`,
      ip: clientIpFrom(await headers()),
    });

    return {
      ok: true,
      message: `تم حذف ${removed} سجل قديم.`,
    };
  }

  const columns: Column<LogRow>[] = [
    {
      key: "createdAt",
      header: "الوقت",
      cell: (row) => (
        <span className="whitespace-nowrap text-[0.8125rem] text-ink-600 dark:text-ink-300">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "userName",
      header: "المستخدم",
      cell: (row) => (
        <span className="text-[0.875rem] font-bold text-brand-900 dark:text-white">
          {row.userName ?? "النظام"}
        </span>
      ),
    },
    {
      key: "action",
      header: "الإجراء",
      cell: (row) => (
        <Badge tone={ACTION_TONES[row.action] ?? "sand"}>
          {ACTIVITY_ACTION_LABELS[row.action] ?? row.action}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "الكيان",
      hideBelow: "md",
      cell: (row) => (
        <span className="text-[0.8125rem] text-ink-600 dark:text-ink-300">
          {ENTITY_LABELS[row.entity] ?? row.entity}
        </span>
      ),
    },
    {
      key: "summary",
      header: "التفاصيل",
      cell: (row) => (
        <span className="text-[0.875rem] leading-relaxed text-ink-700 dark:text-ink-200">
          {row.summary}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      hideBelow: "lg",
      cell: (row) =>
        row.ip ? (
          <span dir="ltr" className="text-[0.75rem] text-ink-500">
            {row.ip}
          </span>
        ) : (
          <span className="text-[0.75rem] text-ink-400">—</span>
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="سجل النشاط"
        description="سجل تدقيق لكل عملية تمت في لوحة التحكم: من فعل ماذا، ومتى، ومن أي عنوان."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/activity", label: "سجل النشاط" },
        ]}
        action={
          <>
            <ActivityExportLink href={exportHref} />
            <PruneActivityButton onPrune={pruneActivity} />
          </>
        }
      />

      {pruned !== null && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-success-100 bg-success-50 px-4 py-3 text-[0.8125rem] font-bold text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-500">
          <Check className="size-4 shrink-0" aria-hidden />
          تم تنظيف السجلات الأقدم من سنة.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="سجلات مطابقة" value={total} icon={ScrollText} />
        <StatCard label="نشاط اليوم" value={todayCount} icon={Activity} tone="info" />
        <StatCard label="آخر ٧ أيام" value={weekCount} icon={Activity} tone="gold" />
      </div>

      <Panel
        title="تصفية السجل"
        description="الإجراء، الكيان، المستخدم، نطاق التاريخ، أو بحث نصي في التفاصيل."
        className="mt-5"
        padded={false}
      >
        <form
          method="get"
          action="/admin/activity"
          className="grid items-end gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6"
        >
          <div className="flex flex-col gap-1.5 xl:col-span-2">
            <label htmlFor="a-q" className="text-sm font-bold text-ink-800">
              بحث في التفاصيل
            </label>
            <Input id="a-q" name="q" defaultValue={q} placeholder="مثال: إنشاء مستخدم" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-action" className="text-sm font-bold text-ink-800">
              الإجراء
            </label>
            <Select id="a-action" name="action" defaultValue={action}>
              <option value="">الكل</option>
              {ACTIVITY_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {ACTIVITY_ACTION_LABELS[value] ?? value}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-entity" className="text-sm font-bold text-ink-800">
              الكيان
            </label>
            <Select id="a-entity" name="entity" defaultValue={entity}>
              <option value="">الكل</option>
              {Object.keys(ENTITY_LABELS).map((key) => (
                <option key={key} value={key}>
                  {ENTITY_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-user" className="text-sm font-bold text-ink-800">
              المستخدم
            </label>
            <Select id="a-user" name="user" defaultValue={userId}>
              <option value="">الجميع</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-from" className="text-sm font-bold text-ink-800">
              من تاريخ
            </label>
            <Input id="a-from" name="from" type="date" defaultValue={from} dir="ltr" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-to" className="text-sm font-bold text-ink-800">
              إلى تاريخ
            </label>
            <Input id="a-to" name="to" type="date" defaultValue={to} dir="ltr" />
          </div>

          <div className="flex gap-2 xl:col-span-6">
            <Button type="submit" icon={ListFilter} className="flex-1 sm:flex-none">
              تصفية
            </Button>
            {isFiltered ? (
              <ButtonLink variant="ghost" href="/admin/activity">
                مسح المرشّحات
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Panel>

      <div className="mt-5">
        <DataTable
          columns={columns}
          rows={rows}
          getKey={(row) => row.id}
          empty="لا توجد سجلات مطابقة للمرشّحات الحالية."
          footer={
            <p className="text-xs text-ink-500">
              تُعرض أحدث {PAGE_SIZE} سجلًا لكل صفحة. إجمالي السجلات المطابقة:{" "}
              <strong>{total}</strong>.
            </p>
          }
        />
      </div>

      <div className="mt-4">
        <Pagination page={page} pageCount={pageCount} total={total} buildHref={listHref} />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <ListFilter className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        الاحتفاظ بسجل النشاط {RETENTION_DAYS} يومًا يوافق سياسة الحد الأدنى من البيانات
        (PDPL). تنظيف السجلات لا يمكن التراجع عنه.
      </p>
    </>
  );
}