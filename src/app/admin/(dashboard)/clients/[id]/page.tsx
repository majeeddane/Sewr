import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { decrypt, formatPhone } from "@/lib/crypto";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/utils";
import {
  CLIENT_STATUS_LABELS,
  CONTACT_METHOD_LABELS,
  WHO_IS_ASKING_LABELS,
  isClientStatus,
} from "@/lib/enums";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";
import {
  AppointmentStatusBadge,
  type AppointmentRow,
} from "@/components/admin/appointments/appointment-list";
import {
  ClientStatusBadge,
  DeleteClientButton,
} from "@/components/admin/clients/client-table";
import { ClientForm, type ClientOption } from "../client-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملف المستفيد" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "clients.view")) redirect("/admin");

  const record = await prisma.client.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, jobTitle: true } },
      program: { select: { id: true, title: true } },
      appointments: {
        orderBy: { preferredDate: "desc" },
        take: 30,
        select: {
          id: true,
          status: true,
          service: true,
          preferredDate: true,
          preferredTime: true,
          channel: true,
        },
      },
    },
  });

  if (!record) notFound();

  const canEdit = can(user.role, "clients.edit");
  const canDelete = can(user.role, "clients.delete");

  const [programs, staff, usedServices] = await Promise.all([
    prisma.contentItem.findMany({
      where: { type: "PROGRAM", isActive: true },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { serviceInterest: { not: null } },
      distinct: ["serviceInterest"],
      select: { serviceInterest: true },
      take: 40,
    }),
  ]);

  const programOptions: ClientOption[] = programs.map((item) => ({
    id: item.id,
    label: item.title,
  }));

  const assigneeOptions: ClientOption[] = staff.map((member) => ({
    id: member.id,
    label: member.jobTitle ? `${member.name} — ${member.jobTitle}` : member.name,
  }));

  const serviceSuggestions = Array.from(
    new Set(
      [
        ...record.serviceInterest ? [record.serviceInterest] : [],
        ...usedServices.map((row) => row.serviceInterest ?? ""),
      ].filter(Boolean),
    ),
  ).slice(0, 40);

  // ── Decryption happens here, on the server, after the capability check ──
  const phone = formatPhone(decrypt(record.phoneEnc));
  const email = decrypt(record.emailEnc) ?? "";
  const notes = decrypt(record.notesEnc) ?? "";

  const statusLabel = isClientStatus(record.status)
  ? CLIENT_STATUS_LABELS[record.status]
  : record.status;

  const appointmentRows: AppointmentRow[] = record.appointments.map((appointment) => ({
    id: appointment.id,
    clientId: record.id,
    clientName: record.fullName,
    service: appointment.service,
    program: "",
    channel: appointment.channel,
    status: appointment.status,
    date: formatDate(appointment.preferredDate),
    dateKey: toDateInputValue(appointment.preferredDate),
    time: appointment.preferredTime ?? "",
    isToday: false,
    notes: "",
  }));

  return (
    <>
      <AdminPageHeader
        title={record.fullName}
        description={`ملف المستفيد ${record.code} — أُضيف في ${formatDate(record.createdAt)}.`}
        breadcrumb={[
          { href: "/admin/clients", label: "المستفيدون" },
          { href: `/admin/clients/${record.id}`, label: record.code },
        ]}
        action={
          <>
            <Link
              href="/admin/clients"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[0.8125rem] font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-50 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              القائمة
            </Link>
            {canEdit && (
              <ButtonLink
                href={`/admin/appointments?new=1&clientId=${record.id}`}
                variant="gold"
                size="sm"
                icon={CalendarPlus}
              >
                حجز موعد
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {/* ── Read-only summary ───────────────────────────── */}
          <Panel
            title="الملخص"
            description="كل ما يظهر هنا فُكّ تشفيره على الخادم بعد التحقق من الصلاحية."
            action={<ClientStatusBadge status={record.status} />}
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                icon={UserRound}
                label="الاسم الكامل"
                value={record.fullName}
              />
              <Detail
                icon={Phone}
                label="رقم الجوال"
                value={phone || "غير مسجّل"}
                ltr
              />
              <Detail
                icon={Mail}
                label="البريد الإلكتروني"
                value={email || record.emailMasked || "غير مسجّل"}
                ltr
              />
              <Detail
                icon={MapPin}
                label="المدينة"
                value={record.city ?? "غير مسجّلة"}
              />
              <Detail
                icon={ShieldCheck}
                label="صفة مقدم الطلب"
                value={WHO_IS_ASKING_LABELS[record.whoIsAsking] ?? record.whoIsAsking}
              />
              <Detail
                icon={CalendarPlus}
                label="الخدمة المطلوبة"
                value={record.serviceInterest ?? "غير محدّدة"}
              />
              <Detail
                icon={ShieldCheck}
                label="البرنامج"
                value={record.program?.title ?? "بدون برنامج"}
              />
              <Detail
                icon={UserRound}
                label="مسؤول الملف"
                value={
                  record.assignedTo
                    ? `${record.assignedTo.name}${
                        record.assignedTo.jobTitle
                          ? ` — ${record.assignedTo.jobTitle}`
                          : ""
                      }`
                    : "غير مُسند"
                }
              />
              <Detail
                icon={Mail}
                label="مصدر الطلب"
                value={record.source ?? "غير محدّد"}
              />
              <Detail
                icon={Phone}
                label="طريقة التواصل المفضّلة"
                value={
                  CONTACT_METHOD_LABELS[record.preferredContactMethod ?? ""] ??
                  record.preferredContactMethod ??
                  "غير محدّدة"
                }
              />
              <Detail
                icon={ShieldCheck}
                label="الحالة"
                value={statusLabel}
              />
              <Detail
                icon={ShieldCheck}
                label="الموافقة على الخصوصية"
                value={
                  record.consentGivenAt
                    ? formatDateTime(record.consentGivenAt)
                    : "غير مسجّلة"
                }
              />
            </dl>

            <div className="mt-5 rounded-xl bg-sand-50 p-4 ring-1 ring-inset ring-sand-200 dark:bg-white/5 dark:ring-white/10">
              <p className="flex items-center gap-2 text-xs font-extrabold text-ink-700 dark:text-ink-200">
                <Lock className="size-3.5 text-brand-600 dark:text-gold-300" aria-hidden />
                ملاحظات سرّية
              </p>
              {notes ? (
                <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-[1.95] text-ink-700 dark:text-ink-200">
                  {notes}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-400">لا توجد ملاحظات مسجّلة.</p>
              )}
            </div>
          </Panel>

          {/* ── Edit form ────────────────────────────────────── */}
          {canEdit ? (
            <div id="edit" className="scroll-mt-6">
              <Panel title="تعديل البيانات" description="يُعاد تشفير الجوال والبريد والملاحظات عند الحفظ.">
                <ClientForm
                  mode="edit"
                  clientId={record.id}
                  programs={programOptions}
                  assignees={assigneeOptions}
                  serviceSuggestions={serviceSuggestions}
                  citySuggestions={record.city ? [record.city] : []}
                  consentGivenAt={
                    record.consentGivenAt
                      ? formatDateTime(record.consentGivenAt)
                      : "غير مسجّل"
                  }
                  defaults={{
                    fullName: record.fullName,
                    phone,
                    email,
                    city: record.city ?? "",
                    whoIsAsking: record.whoIsAsking,
                    serviceInterest: record.serviceInterest ?? "",
                    programId: record.programId ?? "",
                    status: record.status,
                    source: record.source ?? "",
                    preferredContactMethod: record.preferredContactMethod ?? "PHONE",
                    assignedToId: record.assignedToId ?? "",
                    notes,
                  }}
                />
              </Panel>
            </div>
          ) : (
            <Panel title="تعديل البيانات">
              <p className="text-sm text-ink-500">
                تملك صلاحية عرض الملف فقط. التعديل يتطلب صلاحية{" "}
                <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs dark:bg-white/10">
                  clients.edit
                </code>
                .
              </p>
            </Panel>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <Panel
            title="المواعيد"
            description={`${record.appointments.length} موعد مرتبط بهذا الملف.`}
            padded={false}
          >
            {appointmentRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                لا توجد مواعيد مسجّلة.
              </p>
            ) : (
              <ul className="divide-y divide-sand-200 dark:divide-white/10">
                {appointmentRows.map((appointment) => (
                  <li key={appointment.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-bold text-brand-900 dark:text-white">
                        {appointment.service}
                      </p>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {appointment.date}
                      {appointment.time && (
                        <span dir="ltr" className="ms-2">
                          {appointment.time}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="border-t border-sand-200 px-5 py-3.5 dark:border-white/10">
                <ButtonLink
                  href={`/admin/appointments?new=1&clientId=${record.id}`}
                  variant="soft"
                  size="sm"
                  icon={CalendarPlus}
                  className="w-full"
                >
                  حجز موعد جديد
                </ButtonLink>
              </div>
            )}
          </Panel>

          <Panel title="سجل التعديلات" padded={false}>
            <dl className="divide-y divide-sand-200 dark:divide-white/10">
              <AuditRow label="أُنشئ الملف" value={formatDateTime(record.createdAt)} />
              <AuditRow label="آخر تحديث" value={formatDateTime(record.updatedAt)} />
              <AuditRow
                label="الموافقة على الخصوصية"
                value={
                  record.consentGivenAt
                    ? formatDateTime(record.consentGivenAt)
                    : "غير مسجّلة"
                }
              />
              {record.consentIp && (
                <AuditRow label="عنوان IP عند الموافقة" value={record.consentIp} ltr />
              )}
            </dl>
          </Panel>

          {canDelete && (
            <Panel title="منطقة الخطر" description="لا يمكن التراجع عن هذا الإجراء.">
              <DeleteClientButton clientId={record.id} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

// ── Local presentational helpers ──────────────────────────────

function Detail({
  icon: Icon,
  label,
  value,
  ltr = false,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-gold-300 dark:ring-brand-500/25"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-bold text-ink-500 dark:text-ink-400">{label}</dt>
        <dd
          dir={ltr ? "ltr" : undefined}
          className="mt-0.5 break-words text-sm font-bold text-ink-800 dark:text-ink-100"
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function AuditRow({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="text-xs font-bold text-ink-500 dark:text-ink-400">{label}</dt>
      <dd
        dir={ltr ? "ltr" : undefined}
        className="truncate text-xs font-bold text-ink-700 dark:text-ink-200"
      >
        {value}
      </dd>
    </div>
  );
}
