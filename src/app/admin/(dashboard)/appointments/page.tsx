import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Clock3,
  LayoutList,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { decrypt } from "@/lib/crypto";
import { cn, formatDate, toDateInputValue } from "@/lib/utils";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/enums";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel, StatCard } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";
import {
  AppointmentCalendar,
  type CalendarDay,
} from "@/components/admin/clients/appointment-calendar";
import {
  AppointmentForm,
  AppointmentList,
  type AppointmentChannelOption,
  type AppointmentOption,
  type AppointmentRow,
} from "@/components/admin/appointments/appointment-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المواعيد" };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Upper bound for one page of the list view. */
const LIST_LIMIT = 300;

const CHANNELS: AppointmentChannelOption[] = [
  { value: "BOOKING_FORM", label: "نموذج الحجز" },
  { value: "RECEPTION", label: "الاستقبال" },
  { value: "PHONE", label: "مكالمة هاتفية" },
  { value: "WHATSAPP", label: "واتساب" },
  { value: "WALK_IN", label: "حضور شخصي" },
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Local midnight — the appointments board is day-based, not hour-based. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year: year || 0, month: (month || 1) - 1 };
}

const MONTH_LOCALE = "ar-SA-u-nu-latn-ca-gregory";

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "appointments.view")) redirect("/admin");

  const rawView = first(params.view).trim();
  const calendarView = rawView === "calendar";
  const rawStatus = first(params.status).trim();
  const status = (APPOINTMENT_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus
    : "";
  const rawChannel = first(params.channel).trim();
  const channel = CHANNELS.some((item) => item.value === rawChannel)
    ? rawChannel
    : "";
  const rawDate = first(params.date).trim();
  const selectedDate = DATE_PATTERN.test(rawDate) ? rawDate : "";

  const now = new Date();
  const today = startOfDay(now);
  const todayKey = toDateInputValue(today);

  const rawMonth = first(params.month).trim();
  const month = MONTH_PATTERN.test(rawMonth)
    ? rawMonth
    : monthKey(selectedDate ? new Date(`${selectedDate}T00:00:00`) : now);

  const wantsNew = first(params.new).trim() === "1";
  const prefillClient = first(params.clientId).trim();
  const editId = first(params.edit).trim();

  const canEdit = can(user.role, "appointments.edit");
  // Notes are health data: they only cross the boundary for viewers of
  // beneficiary records.
  const canReadNotes = can(user.role, "clients.view");

  // ── Query ──────────────────────────────────────────────────
  const baseWhere: Prisma.AppointmentWhereInput = {
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
  };

  const monthStart = new Date(parseMonth(month).year, parseMonth(month).month, 1);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
    0,
    23,
    59,
    59,
  );
  const prevDate = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const [
    monthAppointments,
    listAppointments,
    clients,
    programs,
    services,
    counts,
    totalCount,
  ] = await Promise.all([
    calendarView
      ? prisma.appointment.findMany({
          where: {
            ...baseWhere,
            preferredDate: { gte: monthStart, lte: monthEnd },
          },
          include: { client: { select: { id: true, fullName: true } } },
          orderBy: [{ preferredDate: "asc" }, { preferredTime: "asc" }],
        })
      : Promise.resolve([]),
    prisma.appointment.findMany({
      where: {
        ...baseWhere,
        ...(selectedDate
          ? {
              preferredDate: {
                gte: new Date(`${selectedDate}T00:00:00`),
                lte: new Date(`${selectedDate}T23:59:59.999`),
              },
            }
          : {}),
      },
      include: {
        client: { select: { id: true, fullName: true } },
        program: { select: { title: true } },
      },
      orderBy: [{ preferredDate: "desc" }, { preferredTime: "desc" }],
      take: LIST_LIMIT,
    }),
    prisma.client.findMany({
      where: { status: { not: "CLOSED" } },
      select: { id: true, fullName: true, code: true },
      orderBy: { searchName: "asc" },
      take: 300,
    }),
    prisma.contentItem.findMany({
      where: { type: "PROGRAM", isActive: true },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    }),
    prisma.contentItem.findMany({
      where: { type: "SERVICE", isActive: true },
      select: { title: true },
      orderBy: { order: "asc" },
    }),
    prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.appointment.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        preferredDate: { gte: today },
      },
    }),
  ]);

  const usedServices = await prisma.appointment.findMany({
    distinct: ["service"],
    select: { service: true },
    take: 40,
  });

  // Editing an existing appointment — decrypted on the server, after the
  // `appointments.view` check above.
  const edited = editId
    ? await prisma.appointment.findUnique({
        where: { id: editId },
        select: {
          id: true,
          clientId: true,
          clientName: true,
          service: true,
          programId: true,
          preferredDate: true,
          preferredTime: true,
          status: true,
          channel: true,
          notesEnc: true,
        },
      })
    : null;

  // ── Calendar grid (plain Date maths, no date library) ──────
  const buckets = new Map<string, CalendarDay["items"]>();
  for (const appointment of monthAppointments) {
    const key = toDateInputValue(appointment.preferredDate);
    const items = buckets.get(key) ?? [];
    items.push({
      id: appointment.id,
      time: appointment.preferredTime ?? "",
      name: appointment.client?.fullName ?? appointment.clientName ?? "بدون اسم",
      status: appointment.status,
    });
    buckets.set(key, items);
  }

  const firstWeekday = monthStart.getDay(); // 0 = Sunday, matches the RTL grid
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const days: CalendarDay[] = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      1 - firstWeekday + index,
    );
    const key = toDateInputValue(date);
    return {
      date: key,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      items: buckets.get(key) ?? [],
    };
  });

  // ── Rows for the list view ────────────────────────────────
  const listRows: AppointmentRow[] = listAppointments.map((appointment) => ({
    id: appointment.id,
    clientId: appointment.client?.id ?? "",
    clientName: appointment.client?.fullName ?? appointment.clientName ?? "بدون اسم",
    service: appointment.service,
    program: appointment.program?.title ?? "",
    channel: appointment.channel,
    status: appointment.status,
    date: formatDate(appointment.preferredDate),
    dateKey: toDateInputValue(appointment.preferredDate),
    time: appointment.preferredTime ?? "",
    isToday: toDateInputValue(appointment.preferredDate) === todayKey,
    notes: canReadNotes ? (decrypt(appointment.notesEnc) ?? "") : "",
  }));

  const statusCount = (key: AppointmentStatus) =>
    counts.find((row) => row.status === key)?._count._all ?? 0;

  // Preserve every filter when switching view or filtering by status.
  const query: Record<string, string> = {};
  for (const key of ["view", "month", "status", "channel", "date"] as const) {
    const value = first(params[key]).trim();
    if (value) query[key] = value;
  }

  const href = (patch: Record<string, string | null>) => {
    const merged: Record<string, string> = { ...query };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") delete merged[key];
      else merged[key] = value;
    }
    const search = new URLSearchParams(merged).toString();
    return search ? `/admin/appointments?${search}` : "/admin/appointments";
  };

  const clientOptions: AppointmentOption[] = clients.map((client) => ({
    id: client.id,
    label: `${client.fullName} — ${client.code}`,
  }));

  const programOptions: AppointmentOption[] = programs.map((program) => ({
    id: program.id,
    label: program.title,
  }));

  const serviceSuggestions = Array.from(
    new Set(
      [
        ...services.map((item) => item.title),
        ...usedServices.map((row) => row.service),
      ].filter(Boolean),
    ),
  ).slice(0, 40);

  return (
    <>
      <AdminPageHeader
        title="المواعيد"
        description="متابعة طلبات الاستشارة: تأكيد، إكمال، أو إلغاء — مع عرض شهري كامل."
        action={
          canEdit && (
            <ButtonLink
              href={href({ new: "1" })}
              variant="primary"
              size="sm"
              icon={CalendarPlus}
            >
              موعد جديد
            </ButtonLink>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="قادمة"
          value={totalCount}
          hint="بانتظار التأكيد أو مؤكدة"
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="بانتظار التأكيد"
          value={statusCount("PENDING")}
          hint="تحتاج تواصلًا مع الطالب"
          icon={Clock3}
          tone="warn"
        />
        <StatCard
          label="تمّت الجلسة"
          value={statusCount("DONE")}
          hint="جلسات مكتملة"
          icon={CalendarDays}
          tone="gold"
        />
        <StatCard
          label="ملغي أو لم يحضر"
          value={statusCount("CANCELLED") + statusCount("NO_SHOW")}
          hint="يحتاج متابعة لاحقة"
          icon={CalendarX2}
          tone="info"
        />
      </div>

      {/* ── View switch + filters ────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white p-3 shadow-soft dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-1 rounded-xl bg-sand-100 p-1 dark:bg-white/10">
          <ViewTab
            href={href({ view: null, date: null })}
            active={!calendarView}
            icon={LayoutList}
            label="قائمة"
          />
          <ViewTab
            href={href({ view: "calendar" })}
            active={calendarView}
            icon={CalendarDays}
            label="تقويم شهري"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusFilterPills query={query} href={href} />
          {selectedDate && (
            <Link
              href={href({ date: null })}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30"
            >
              <X className="size-3.5" aria-hidden />
              إلغاء تصفية اليوم ({formatDate(new Date(`${selectedDate}T00:00:00`))})
            </Link>
          )}
          {(status || channel || selectedDate) && (
            <Link
              href="/admin/appointments"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
            >
              <X className="size-3.5" aria-hidden />
              مسح الكل
            </Link>
          )}
        </div>
      </div>

      {/* ── New / edit appointment form ─────────────────────── */}
      {canEdit && edited && (
        <div className="mt-5" id="edit">
          <Panel
            title="تعديل الموعد"
            description={`موعد بتاريخ ${formatDate(edited.preferredDate)} — ${edited.service}`}
            action={
              <Link
                href={href({ edit: null })}
                aria-label="إغلاق نموذج التعديل"
                className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-sand-100 hover:text-ink-700 dark:hover:bg-white/10"
              >
                <X className="size-4" aria-hidden />
              </Link>
            }
          >
            <AppointmentForm
              mode="edit"
              appointmentId={edited.id}
              clients={clientOptions}
              programs={programOptions}
              services={serviceSuggestions}
              channels={CHANNELS}
              closeHref={href({ edit: null, new: null })}
              defaults={{
                clientId: edited.clientId ?? "",
                clientName: edited.clientName ?? "",
                service: edited.service,
                programId: edited.programId ?? "",
                preferredDate: toDateInputValue(edited.preferredDate),
                preferredTime: edited.preferredTime ?? "",
                status: edited.status,
                channel: edited.channel,
                notes: canReadNotes ? (decrypt(edited.notesEnc) ?? "") : "",
              }}
            />
          </Panel>
        </div>
      )}

      {canEdit && wantsNew && !edited && (
        <div className="mt-5" id="new">
          <Panel
            title="حجز موعد"
            description="اربطه بملف مستفيد مسجّل، أو اتركه فارغًا وسجّل الاسم يدويًا للحضور الشخصي."
            action={
              <Link
                href={href({ new: null })}
                aria-label="إغلاق نموذج الحجز"
                className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-sand-100 hover:text-ink-700 dark:hover:bg-white/10"
              >
                <X className="size-4" aria-hidden />
              </Link>
            }
          >
            <AppointmentForm
              mode="create"
              clients={clientOptions}
              programs={programOptions}
              services={serviceSuggestions}
              channels={CHANNELS}
              defaults={{
                preferredDate: selectedDate || todayKey,
                clientId: prefillClient,
              }}
            />
          </Panel>
        </div>
      )}

      {/* ── Calendar ────────────────────────────────────────── */}
      {calendarView && (
        <div className="mt-5">
          <AppointmentCalendar
            days={days}
            monthLabel={new Intl.DateTimeFormat(MONTH_LOCALE, {
              month: "long",
              year: "numeric",
            }).format(monthStart)}
            prevMonth={monthKey(prevDate)}
            nextMonth={monthKey(nextDate)}
            query={query}
            selectedDate={selectedDate || null}
            todayKey={todayKey}
          />
        </div>
      )}

      {/* ── List ────────────────────────────────────────────── */}
      <div className="mt-5">
        <Panel
          title={calendarView ? "مواعيد اليوم المختار" : "قائمة المواعيد"}
          description={
            selectedDate
              ? `يعرض ${formatDate(new Date(`${selectedDate}T00:00:00`))}`
              : calendarView
                ? "اختر يومًا من التقويم لتصفية القائمة عليه."
                : `أحدث ${Math.min(listRows.length, LIST_LIMIT)} موعد.`
          }
          padded={false}
        >
          <div className="p-0">
            <AppointmentList
              rows={listRows}
              canEdit={canEdit}
              query={query}
              empty={
                selectedDate
                  ? "لا توجد مواعيد في هذا اليوم."
                  : "لا توجد مواعيد مطابقة. جرّب توسيع عوامل التصفية."
              }
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

// ── Local presentational helpers ──────────────────────────────

function ViewTab({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutList;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
        active
          ? "bg-white text-brand-800 shadow-soft dark:bg-white/15 dark:text-white"
          : "text-ink-500 hover:text-brand-700 dark:text-ink-300 dark:hover:text-white",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

function StatusFilterPills({
  query,
  href,
}: {
  query: Record<string, string>;
  href: (patch: Record<string, string | null>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={href({ status: null })}
        className={cn(
          "inline-flex h-9 items-center rounded-full px-3 text-xs font-bold ring-1 ring-inset transition-colors",
          query.status
            ? "bg-white text-ink-600 ring-sand-300 hover:bg-sand-50 dark:bg-white/10 dark:text-ink-300 dark:ring-white/15"
            : "bg-brand-800 text-white ring-brand-800",
        )}
      >
        الكل
      </Link>
      {APPOINTMENT_STATUSES.map((status) => (
        <Link
          key={status}
          href={href({ status: query.status === status ? null : status })}
          className={cn(
            "inline-flex h-9 items-center rounded-full px-3 text-xs font-bold ring-1 ring-inset transition-colors",
            query.status === status
              ? "bg-brand-800 text-white ring-brand-800"
              : "bg-white text-ink-600 ring-sand-300 hover:bg-sand-50 dark:bg-white/10 dark:text-ink-300 dark:ring-white/15",
          )}
        >
          {APPOINTMENT_STATUS_LABELS[status]}
        </Link>
      ))}
      {CHANNELS.map((item) => (
        <Link
          key={item.value}
          href={href({ channel: query.channel === item.value ? null : item.value })}
          className={cn(
            "inline-flex h-9 items-center rounded-full px-3 text-xs font-bold ring-1 ring-inset transition-colors",
            query.channel === item.value
              ? "bg-gold-500 text-brand-950 ring-gold-500"
              : "bg-white text-ink-600 ring-sand-300 hover:bg-sand-50 dark:bg-white/10 dark:text-ink-300 dark:ring-white/15",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
