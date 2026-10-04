import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  Download,
  Handshake,
  PhoneCall,
  UserPlus,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { blindIndex, decrypt, formatPhone, normalizeName } from "@/lib/crypto";
import { formatDate } from "@/lib/utils";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  type ClientStatus,
} from "@/lib/enums";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel, Pagination, StatCard } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";
import { ClientTable, type ClientRow } from "@/components/admin/clients/client-table";
import { ClientFilters, CsvDownload } from "./client-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المستفيدون" };

const PAGE_SIZE = 20;
/** Hard ceiling for a single CSV export — protects the request from OOM. */
const EXPORT_LIMIT = 5000;

const SORTS = {
  newest: [{ createdAt: "desc" } as const],
  oldest: [{ createdAt: "asc" } as const],
  // `searchName` is the lower-cased copy of `fullName`, which gives a
  // case-insensitive alphabetical order on every SQL dialect.
  name: [{ searchName: "asc" } as const, { createdAt: "desc" } as const],
  status: [{ status: "asc" } as const, { createdAt: "desc" } as const],
} as const;

type SortKey = keyof typeof SORTS;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "clients.view")) redirect("/admin");

  const q = first(params.q).trim();
  const status = first(params.status).trim();
  const source = first(params.source).trim();
  const assigned = first(params.assigned).trim();
  const sortRaw = first(params.sort).trim();
  const sort: SortKey = sortRaw in SORTS ? (sortRaw as SortKey) : "newest";
  const exportFormat = first(params.export).trim();
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const canEdit = can(user.role, "clients.edit");
  const canExport = can(user.role, "clients.export");

  // ── Where clause ───────────────────────────────────────────
  const where: Prisma.ClientWhereInput = {};
  if (status && (CLIENT_STATUSES as readonly string[]).includes(status)) {
    where.status = status;
  }
  if (source && (CLIENT_SOURCES as readonly string[]).includes(source)) {
    where.source = source;
  }
  if (assigned) {
    where.assignedToId = assigned === "unassigned" ? null : assigned;
  }
  if (q) {
    const nameTerm = normalizeName(q);
    const cityTerm = q.toLowerCase();
    // The blind index of the search term matches `phoneHash` / `emailHash` for
    // an exact phone / e-mail lookup, while the lower-cased shadow columns give
    // a portable `contains` (SQLite's `contains` is case-sensitive).
    const hash = blindIndex(q);
    where.OR = [
      { searchName: { contains: nameTerm } },
      { searchCity: { contains: cityTerm } },
      { code: { contains: q.toUpperCase() } },
      ...(hash ? [{ phoneHash: hash }, { emailHash: hash }] : []),
    ];
  }

  const orderBy: Prisma.ClientOrderByWithRelationInput[] = [...SORTS[sort]];

  // ── CSV export ─────────────────────────────────────────────
  if (exportFormat === "csv") {
    if (!canExport) {
      return (
        <>
          <AdminPageHeader title="المستفيدون" />
          <Panel title="غير مسموح">
            <p className="text-sm text-ink-600">
              ليس لديك صلاحية تصدير بيانات المستفيدين.
            </p>
          </Panel>
        </>
      );
    }

    const rows = await prisma.client.findMany({
      where,
      orderBy,
      take: EXPORT_LIMIT,
      select: {
        code: true,
        fullName: true,
        phoneEnc: true,
        emailEnc: true,
        city: true,
        whoIsAsking: true,
        serviceInterest: true,
        status: true,
        source: true,
        preferredContactMethod: true,
        createdAt: true,
        consentGivenAt: true,
        assignedTo: { select: { name: true } },
      },
    });

    const header = [
      "المرجع",
      "الاسم",
      "الجوال",
      "البريد الإلكتروني",
      "المدينة",
      "صفة مقدم الطلب",
      "الخدمة المطلوبة",
      "الحالة",
      "مصدر الطلب",
      "المسؤول",
      "تاريخ التسجيل",
      "تاريخ الموافقة على الخصوصية",
    ];

    const body = rows.map((row) =>
      [
        row.code,
        row.fullName,
        formatPhone(decrypt(row.phoneEnc)),
        decrypt(row.emailEnc) ?? "",
        row.city ?? "",
        row.whoIsAsking,
        row.serviceInterest ?? "",
        CLIENT_STATUS_LABELS[row.status as ClientStatus] ?? row.status,
        row.source ?? "",
        row.assignedTo?.name ?? "",
        formatDate(row.createdAt),
        formatDate(row.consentGivenAt),
      ]
        .map(csvCell)
        .join(","),
    );

    // A real `text/csv` response, BOM-prefixed so Excel detects the UTF-8
    // Arabic content instead of mangling it.
    const csv = new Response(["\uFEFF", header.map(csvCell).join(","), ...body].join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "EXPORT",
      entity: "Client",
      summary: `تصدير قائمة المستفيدين (${rows.length} سجل) بصيغة CSV`,
    });

    const stamp = todayStamp();

    return (
      <>
        <AdminPageHeader
          title="تصدير المستفيدين"
          description="ملف جاهز لبرنامج Excel مع الأرقام والبريد مفكوكة التعمية."
          breadcrumb={[{ href: "/admin/clients", label: "المستفيدون" }]}
        />
        <Panel title="ملف CSV جاهز">
          <p className="text-sm leading-relaxed text-ink-600">
            يحتوي الملف على <strong>{rows.length}</strong> سجل مطابق لعوامل التصفية
            الحالية، بترميز UTF-8 مع علامة BOM ليفتح بالعربية في Excel.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/*
              A page component cannot answer a request with its own body, so the
              bytes were built and encoded server-side (see the `Response` above)
              and are released here through a short-lived object URL.
            */}
            <CsvDownload filename={`sewr-waie-clients-${stamp}.csv`} text={await csv.text()} />
            <ButtonLink href="/admin/clients" variant="ghost" size="sm">
              العودة إلى القائمة
            </ButtonLink>
          </div>
        </Panel>
      </>
    );
  }

  // ── Listing ────────────────────────────────────────────────
  const [total, rows, stats, assignees] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        fullName: true,
        phoneEnc: true,
        city: true,
        serviceInterest: true,
        status: true,
        createdAt: true,
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.client.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const statusCount = (key: ClientStatus) =>
    stats.find((row) => row.status === key)?._count._all ?? 0;

  // Only decrypted display strings cross into the client table, and only after
  // the `clients.view` check above.
  const clientRows: ClientRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    fullName: row.fullName,
    phone: formatPhone(decrypt(row.phoneEnc)),
    city: row.city ?? "",
    serviceInterest: row.serviceInterest ?? "",
    status: row.status,
    assignedTo: row.assignedTo?.name ?? "",
    createdAt: formatDate(row.createdAt),
    editable: canEdit,
  }));

  // Keeps every filter (and the sort) while paging.
  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      q,
      status,
      source,
      assigned,
      sort: sort === "newest" ? "" : sort,
    })) {
      if (value) query.set(key, value);
    }
    query.set("page", String(next));
    return `/admin/clients?${query.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        title="المستفيدون"
        description="سجلّ مركزي لطلبات الاستشارة. أرقام الجوال والبريد مشفّرة في قاعدة البيانات."
        action={
          <>
            {canExport && (
              <ButtonLink
                href={exportHref({ q, status, source, assigned, sort })}
                variant="gold"
                size="sm"
                icon={Download}
              >
                تصدير Excel
              </ButtonLink>
            )}
            {canEdit && (
              <ButtonLink
                href="/admin/clients/new"
                variant="primary"
                size="sm"
                icon={UserPlus}
              >
                مستفيد جديد
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي المستفيدين"
          value={stats.reduce((sum, row) => sum + row._count._all, 0)}
          hint="كل الملفات المسجّلة"
          icon={Users}
          href="/admin/clients"
        />
        <StatCard
          label="طلبات جديدة"
          value={statusCount("NEW")}
          hint="بانتظار أول تواصل"
          icon={PhoneCall}
          tone="info"
          href="/admin/clients?status=NEW"
        />
        <StatCard
          label="تم التواصل"
          value={statusCount("CONTACTED") + statusCount("BOOKED")}
          hint="تم التواصل أو تم الحجز"
          icon={Handshake}
          tone="success"
          href="/admin/clients?status=CONTACTED"
        />
        <StatCard
          label="مكتمل أو مغلق"
          value={statusCount("COMPLETED") + statusCount("CLOSED")}
          hint="أُغلقت رحلة المتابعة"
          icon={CalendarClock}
          tone="gold"
          href="/admin/clients?status=COMPLETED"
        />
      </div>

      <div className="mt-5">
        <ClientFilters
          q={q}
          status={status}
          source={source}
          assigned={assigned}
          sort={sort}
          statuses={CLIENT_STATUSES.map((value) => ({
            value,
            label: CLIENT_STATUS_LABELS[value],
          }))}
          sources={CLIENT_SOURCES.map((value) => ({ value, label: value }))}
          assignees={assignees.map((assignee) => ({
            value: assignee.id,
            label: assignee.name,
          }))}
        />
      </div>

      <div className="mt-5">
        <ClientTable rows={clientRows} />
      </div>

      {total > 0 && (
        <div className="mt-5">
          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={total}
            buildHref={buildHref}
          />
        </div>
      )}
    </>
  );
}

// ── Small helpers ────────────────────────────────────────────

/** `YYYY-MM-DD`, safe for a file name (no locale separators). */
function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function exportHref(values: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && !(key === "sort" && value === "newest")) query.set(key, value);
  }
  query.set("export", "csv");
  return `/admin/clients?${query.toString()}`;
}
