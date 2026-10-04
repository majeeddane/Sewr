"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/widgets";
import { Badge } from "@/components/ui/primitives";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { deleteClient } from "@/app/admin/(dashboard)/clients/actions";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_STYLES,
  type ClientStatus,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * Row shape handed to the table.
 *
 * Note what is *not* here: `phoneEnc`, `emailEnc` and `notesEnc` never cross
 * the server/client boundary. The server decrypts once and passes only the
 * display strings below, and only after checking `clients.view`.
 */
export interface ClientRow {
  id: string;
  code: string;
  fullName: string;
  /** Decrypted, formatted for display. */
  phone: string;
  city: string;
  serviceInterest: string;
  status: string;
  assignedTo: string;
  /** Pre-formatted on the server (Arabic, Latin digits). */
  createdAt: string;
  editable: boolean;
}

/** Dark-mode companions for the light-only status palette in `@/lib/enums`. */
const STATUS_DARK: Record<ClientStatus, string> = {
  NEW: "dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30",
  CONTACTED: "dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  BOOKED: "dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30",
  COMPLETED: "dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  CLOSED: "dark:bg-white/10 dark:text-ink-300 dark:ring-white/15",
};

function statusOf(value: string): ClientStatus {
  return (value in CLIENT_STATUS_LABELS ? value : "NEW") as ClientStatus;
}

export function ClientStatusBadge({ status }: { status: string }) {
  const key = statusOf(status);
  return (
    <Badge className={cn(CLIENT_STATUS_STYLES[key], STATUS_DARK[key])} tone="sand">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full ring-1 ring-inset",
          key === "NEW" && "bg-sky-500 ring-sky-300",
          key === "CONTACTED" && "bg-amber-500 ring-amber-300",
          key === "BOOKED" && "bg-violet-500 ring-violet-300",
          key === "COMPLETED" && "bg-emerald-500 ring-emerald-300",
          key === "CLOSED" && "bg-ink-400 ring-ink-300",
        )}
      />
      {CLIENT_STATUS_LABELS[key]}
    </Badge>
  );
}

export function ClientTable({
  rows,
  empty = "لا يوجد مستفيدون مطابقون لعوامل التصفية.",
}: {
  rows: ClientRow[];
  empty?: string;
}) {
  const router = useRouter();

  const columns: Column<ClientRow>[] = [
    {
      key: "code",
      header: "المرجع",
      cell: (row) => (
        <span dir="ltr" className="font-mono text-xs font-bold text-brand-700 dark:text-gold-300">
          {row.code}
        </span>
      ),
      className: "whitespace-nowrap",
    },
    {
      key: "fullName",
      header: "الاسم",
      cell: (row) => (
        <span className="font-bold text-brand-900 dark:text-white">{row.fullName}</span>
      ),
    },
    {
      key: "phone",
      header: "الجوال",
      cell: (row) =>
        row.phone ? (
          <span dir="ltr" className="whitespace-nowrap font-semibold">
            {row.phone}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
      hideBelow: "md",
    },
    {
      key: "city",
      header: "المدينة",
      cell: (row) => row.city || <span className="text-ink-400">—</span>,
      hideBelow: "lg",
    },
    {
      key: "service",
      header: "الخدمة",
      cell: (row) =>
        row.serviceInterest ? (
          <span className="line-clamp-1">{row.serviceInterest}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
      hideBelow: "lg",
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => <ClientStatusBadge status={row.status} />,
    },
    {
      key: "assignedTo",
      header: "المسؤول",
      cell: (row) =>
        row.assignedTo || <span className="text-ink-400">غير مُسند</span>,
      hideBelow: "xl",
    },
    {
      key: "createdAt",
      header: "التاريخ",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-500">{row.createdAt}</span>
      ),
      hideBelow: "md",
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      cell: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Link
            href={`/admin/clients/${row.id}`}
            aria-label={`عرض ملف ${row.fullName}`}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-sand-100 px-3 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15"
          >
            عرض
            <ArrowLeft className="size-3.5" aria-hidden />
          </Link>
          {row.editable && (
            <Link
              href={`/admin/clients/${row.id}#edit`}
              aria-label={`تعديل بيانات ${row.fullName}`}
              className="inline-flex size-8 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 dark:bg-white/10 dark:text-gold-300 dark:ring-white/10 dark:hover:bg-white/15"
            >
              <Pencil className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
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
      onRowClick={(row) => router.push(`/admin/clients/${row.id}`)}
      empty={empty}
    />
  );
}

/**
 * Two-step delete for a beneficiary file.
 *
 * Deleting is irreversible and `Client.appointments` keeps its rows (the
 * relation is `onDelete: SetNull`), so the confirmation copy says so plainly.
 */
export function DeleteClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { run, pending } = useAction();

  return (
    <ConfirmButton
      variant="danger"
      confirmLabel="تأكيد الحذف النهائي"
      message="سيُحذف ملف المستفيد وكل بياناته نهائيًا. المواعيد السابقة تبقى في السجل بدون ملف. هل أنت متأكد؟"
      onConfirm={() =>
        void run(() => deleteClient(clientId), {
          successMessage: "تم حذف الملف.",
          onSuccess: () => router.push("/admin/clients"),
        })
      }
    >
      <Trash2 className="size-3.5" aria-hidden />
      {pending ? "جارٍ الحذف…" : "حذف الملف"}
    </ConfirmButton>
  );
}
