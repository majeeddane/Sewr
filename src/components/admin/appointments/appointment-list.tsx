"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Trash2,
  UserX,
} from "lucide-react";
import { DataTable, type Column } from "@/components/admin/widgets";
import { Badge, Button } from "@/components/ui/primitives";
import {
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  isAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/components/admin/use-action";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/app/admin/(dashboard)/appointments/actions";

// ── Shared status presentation (used by the calendar too) ─────

/** Dark-mode companions for the light-only status palette in `@/lib/enums`. */
export const APPOINTMENT_STATUS_DARK: Record<AppointmentStatus, string> = {
  PENDING: "dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  CONFIRMED: "dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  CANCELLED: "dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  DONE: "dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30",
  NO_SHOW: "dark:bg-white/10 dark:text-ink-300 dark:ring-white/15",
};

export const APPOINTMENT_STATUS_DOT: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-emerald-500",
  CANCELLED: "bg-rose-500",
  DONE: "bg-violet-500",
  NO_SHOW: "bg-ink-400",
};

export function appointmentStatus(value: string): AppointmentStatus {
  return isAppointmentStatus(value) ? value : "PENDING";
}

export function appointmentStatusClasses(value: string): string {
  const key = appointmentStatus(value);
  return cn(APPOINTMENT_STATUS_STYLES[key], APPOINTMENT_STATUS_DARK[key]);
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  const key = appointmentStatus(status);
  return (
    <Badge tone="sand" className={appointmentStatusClasses(key)}>
      <span
        aria-hidden
        className={cn("size-2 rounded-full", APPOINTMENT_STATUS_DOT[key])}
      />
      {APPOINTMENT_STATUS_LABELS[key]}
    </Badge>
  );
}

// ── Types shared with the Server Actions ──────────────────────

export interface AppointmentActionResult extends ActionResult {
  id?: string;
}

export interface AppointmentFormValues {
  clientId: string;
  clientName: string;
  service: string;
  programId: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  channel: string;
  notes: string;
}

export interface AppointmentOption {
  id: string;
  label: string;
}

export interface AppointmentChannelOption {
  value: string;
  label: string;
}

export interface AppointmentRow {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  program: string;
  channel: string;
  status: string;
  /** Pre-formatted Arabic date. */
  date: string;
  /** `YYYY-MM-DD` for links. */
  dateKey: string;
  /** `HH:mm` or empty. */
  time: string;
  isToday: boolean;
  /** Decrypted note — only populated for users holding `clients.view`. */
  notes: string;
}

// ── List ──────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  BOOKING_FORM: "نموذج الحجز",
  RECEPTION: "الاستقبال",
  PHONE: "مكالمة هاتفية",
  WHATSAPP: "واتساب",
  WALK_IN: "حضور شخصي",
};

export function AppointmentList({
  rows,
  canEdit,
  query = {},
  empty = "لا توجد مواعيد مطابقة.",
}: {
  rows: AppointmentRow[];
  canEdit: boolean;
  /** Current query string, so the edit link keeps the active filters. */
  query?: Record<string, string>;
  empty?: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();

  const change = (id: string, status: string) =>
    run(() => updateAppointmentStatus(id, status), {
      successMessage: `تم تحديث الموعد: ${APPOINTMENT_STATUS_LABELS[appointmentStatus(status)]}`,
    });

  const editHref = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(query);
      params.set("edit", id);
      params.delete("new");
      return `/admin/appointments?${params.toString()}`;
    },
    [query],
  );

  const columns: Column<AppointmentRow>[] = [
    {
      key: "when",
      header: "الموعد",
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap font-bold text-brand-900 dark:text-white">
            {row.date}
            {row.isToday && (
              <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-[0.625rem] font-extrabold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
                اليوم
              </span>
            )}
          </span>
          <span dir="ltr" className="text-xs text-ink-500">
            {row.time || "—"}
          </span>
        </div>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "client",
      header: "العميل",
      cell: (row) =>
        row.clientId ? (
          <Link
            href={`/admin/clients/${row.clientId}`}
            onClick={(event) => event.stopPropagation()}
            className="font-bold text-brand-800 underline-offset-4 hover:underline dark:text-gold-300"
          >
            {row.clientName}
          </Link>
        ) : (
          <span className="font-bold text-ink-700 dark:text-ink-200">
            {row.clientName}
            <span className="ms-2 text-xs font-medium text-ink-400">(حضور شخصي)</span>
          </span>
        ),
    },
    {
      key: "service",
      header: "الخدمة",
      cell: (row) => (
        <div className="min-w-0">
          <p className="line-clamp-1 font-semibold">{row.service}</p>
          {row.program && (
            <p className="line-clamp-1 text-xs text-ink-500">{row.program}</p>
          )}
        </div>
      ),
      hideBelow: "md",
    },
    {
      key: "notes",
      header: "ملاحظات",
      cell: (row) =>
        row.notes ? (
          <span className="line-clamp-2 text-xs leading-relaxed text-ink-500">
            {row.notes}
          </span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
      hideBelow: "xl",
    },
    {
      key: "channel",
      header: "القناة",
      cell: (row) => (
        <span className="text-xs text-ink-500">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>
      ),
      hideBelow: "xl",
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => <AppointmentStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      cell: (row) =>
        canEdit ? (
          <div
            className="flex flex-wrap items-center justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              href={editHref(row.id)}
              aria-label="تعديل الموعد"
              title="تعديل الموعد"
              className="inline-flex size-8 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 dark:bg-white/10 dark:text-gold-300 dark:ring-white/10 dark:hover:bg-white/15"
            >
              <Pencil className="size-3.5" aria-hidden />
            </Link>
            {row.status === "PENDING" && (
              <Button
                type="button"
                size="sm"
                variant="soft"
                icon={CheckCircle2}
                disabled={pending}
                className="h-8 px-3 text-xs"
                onClick={() => void change(row.id, "CONFIRMED")}
              >
                تأكيد
              </Button>
            )}
            {(row.status === "PENDING" || row.status === "CONFIRMED") && (
              <Button
                type="button"
                size="sm"
                variant="white"
                icon={CalendarCheck}
                disabled={pending}
                className="h-8 px-3 text-xs"
                onClick={() => void change(row.id, "DONE")}
              >
                تمّت
              </Button>
            )}
            {row.status === "CONFIRMED" && (
              <Button
                type="button"
                size="sm"
                variant="white"
                icon={UserX}
                disabled={pending}
                className="h-8 px-3 text-xs"
                onClick={() => void change(row.id, "NO_SHOW")}
              >
                لم يحضر
              </Button>
            )}
            {row.status !== "CANCELLED" && row.status !== "DONE" && (
              <ConfirmButton
                size="sm"
                variant="outline"
                confirmLabel="تأكيد الإلغاء"
                message="سيُلغى الموعد ويمكن للمركز عرض موعد بديل. هل أنت متأكد؟"
                onConfirm={() => void change(row.id, "CANCELLED")}
              >
                <Ban className="size-3.5" aria-hidden />
                إلغاء
              </ConfirmButton>
            )}
            <ConfirmButton
              size="sm"
              variant="danger"
              confirmLabel="تأكيد الحذف"
              message="سيُحذف الموعد نهائيًا من السجل. هل أنت متأكد؟"
              onConfirm={() =>
                void run(() => deleteAppointment(row.id), {
                  successMessage: "تم حذف الموعد.",
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden />
              حذف
            </ConfirmButton>
          </div>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        ),
      className: "text-end",
      headerClassName: "text-end",
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getKey={(row) => row.id}
      onRowClick={(row) => {
        if (row.clientId) router.push(`/admin/clients/${row.clientId}`);
      }}
      empty={empty}
    />
  );
}

// ── Create / edit form ────────────────────────────────────────

const EMPTY: AppointmentFormValues = {
  clientId: "",
  clientName: "",
  service: "",
  programId: "",
  preferredDate: "",
  preferredTime: "",
  status: "PENDING",
  channel: "RECEPTION",
  notes: "",
};

export function AppointmentForm({
  mode,
  appointmentId,
  defaults,
  clients = [],
  programs = [],
  services = [],
  channels = [],
  closeHref = "/admin/appointments",
}: {
  mode: "create" | "edit";
  appointmentId?: string;
  defaults?: Partial<AppointmentFormValues>;
  clients?: AppointmentOption[];
  programs?: AppointmentOption[];
  services?: string[];
  channels?: AppointmentChannelOption[];
  /** Where to go once an edited appointment has been saved. */
  closeHref?: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [values, setValues] = React.useState<AppointmentFormValues>({
    ...EMPTY,
    ...defaults,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const walkIn = values.clientId === "";

  const set =
    (key: keyof AppointmentFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const result: AppointmentActionResult =
      mode === "create"
        ? await run(() => createAppointment(values), { successMessage: "تم إنشاء الموعد." })
        : await run(() => updateAppointment(appointmentId ?? "", values), {
            successMessage: "تم حفظ الموعد.",
          });

    if (!result.ok) {
      if (result.errors) setErrors(result.errors);
      return;
    }
    if (mode === "create") {
      // Keep the chosen date so a receptionist can book a second slot quickly.
      setValues({
        ...EMPTY,
        preferredDate: values.preferredDate,
        clientId: values.clientId,
        clientName: values.clientName,
        channel: values.channel,
      });
    } else {
      router.push(closeHref);
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="العميل"
          htmlFor="appointment-client"
          required
          error={errors.clientId ?? errors.clientName}
          hint={
            walkIn
              ? "لم يُختَر ملف مستفيد — اكتب الاسم الحر أدناه (حضور شخصي)."
              : "مرتبط بملف مستفيد مسجّل."
          }
        >
          <Select
            id="appointment-client"
            name="clientId"
            value={values.clientId}
            onChange={set("clientId")}
            invalid={Boolean(errors.clientId)}
          >
            <option value="">— حضور شخصي بدون ملف —</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </Select>
        </Field>

        {walkIn && (
          <Field
            label="اسم العميل (حر)"
            htmlFor="appointment-clientName"
            required
            error={errors.clientName}
          >
            <Input
              id="appointment-clientName"
              name="clientName"
              value={values.clientName}
              onChange={set("clientName")}
              invalid={Boolean(errors.clientName)}
              placeholder="اسم الحاضر شخصيًا"
            />
          </Field>
        )}

        <Field
          label="الخدمة"
          htmlFor="appointment-service"
          required
          error={errors.service}
          className={walkIn ? "sm:col-span-2" : undefined}
        >
          <Input
            id="appointment-service"
            name="service"
            list="appointment-service-options"
            value={values.service}
            onChange={set("service")}
            invalid={Boolean(errors.service)}
            placeholder="جلسة استشارية فردية"
          />
          <datalist id="appointment-service-options">
            {services.map((service) => (
              <option key={service} value={service} />
            ))}
          </datalist>
        </Field>

        <Field label="البرنامج" htmlFor="appointment-program" error={errors.programId} optional>
          <Select
            id="appointment-program"
            name="programId"
            value={values.programId}
            onChange={set("programId")}
            invalid={Boolean(errors.programId)}
          >
            <option value="">بدون برنامج</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="التاريخ المفضّل"
          htmlFor="appointment-date"
          required
          error={errors.preferredDate}
        >
          <Input
            id="appointment-date"
            name="preferredDate"
            type="date"
            dir="ltr"
            value={values.preferredDate}
            onChange={set("preferredDate")}
            invalid={Boolean(errors.preferredDate)}
          />
        </Field>

        <Field
          label="الوقت"
          htmlFor="appointment-time"
          error={errors.preferredTime}
          optional
          hint="يُحفظ كنص «HH:mm» لتفادي اختلاف المناطق الزمنية."
        >
          <Input
            id="appointment-time"
            name="preferredTime"
            type="time"
            dir="ltr"
            value={values.preferredTime}
            onChange={set("preferredTime")}
            invalid={Boolean(errors.preferredTime)}
          />
        </Field>

        <Field
          label="الحالة"
          htmlFor="appointment-status"
          required
          error={errors.status}
        >
          <Select
            id="appointment-status"
            name="status"
            value={values.status}
            onChange={set("status")}
            invalid={Boolean(errors.status)}
          >
            {APPOINTMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPOINTMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="القناة"
          htmlFor="appointment-channel"
          required
          error={errors.channel}
        >
          <Select
            id="appointment-channel"
            name="channel"
            value={values.channel}
            onChange={set("channel")}
            invalid={Boolean(errors.channel)}
          >
            {channels.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="ملاحظات"
          htmlFor="appointment-notes"
          error={errors.notes}
          optional
          hint="تُخزَّن مشفّرة ولا تظهر إلا لمن يملك صلاحية عرض بيانات المستفيدين."
          className="sm:col-span-2"
        >
          <Textarea
            id="appointment-notes"
            name="notes"
            rows={4}
            value={values.notes}
            onChange={set("notes")}
            invalid={Boolean(errors.notes)}
            placeholder="حالة المُحال، احتياجاته، أو أي ظرف يجب معرفته قبل الجلسة…"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-sand-200 pt-5 dark:border-white/10">
        <SubmitButton pending={pending} className="w-auto px-8">
          <CalendarPlus className="size-4" aria-hidden />
          {mode === "create" ? "حجز الموعد" : "حفظ الموعد"}
        </SubmitButton>
      </div>
    </form>
  );
}
