"use client";

import * as React from "react";
import Link from "next/link";
import {
  KeyRound,
  Pencil,
  Plus,
  ShieldAlert,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react";

import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { DataTable, type Column } from "@/components/admin/widgets";
import { Field, Input, RadioCard, SubmitButton } from "@/components/ui/form";
import { Badge, Button } from "@/components/ui/primitives";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/enums";
import { cn, timeAgo } from "@/lib/utils";
import {
  createUserAction,
  deleteUserAction,
  setUserPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
  type UserActionResult,
} from "./actions";

/** Row shape handed to the client table — no secrets cross this boundary. */
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  phone: string | null;
  isActive: boolean;
  /** ISO string so the value survives the RSC → client hop. */
  lastLoginAt: string | null;
  activeSessions: number;
  /** True for the single SUPER_ADMIN left in the system. */
  isLastSuperAdmin: boolean;
}

const ROLE_TONES: Record<Role, "brand" | "gold" | "info"> = {
  SUPER_ADMIN: "brand",
  EDITOR: "gold",
  RECEPTIONIST: "info",
};

// ── Modal ─────────────────────────────────────────────────────

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/50 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-lift dark:border-white/10 dark:bg-[#1b1524]"
      >
        <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-extrabold text-brand-900 dark:text-white">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              {description}
            </p>
          )}
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Create / edit form ────────────────────────────────────────

function UserForm({
  target,
  currentUserId,
  onDone,
}: {
  target: AdminUserRow | null;
  currentUserId: string;
  onDone: () => void;
}) {
  const isEdit = target !== null;
  const isSelf = target?.id === currentUserId;
  const { run, pending } = useAction();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const action = isEdit ? updateUserAction(formData) : createUserAction(formData);
    const result: UserActionResult = await run(() => action);
    if (result.ok) {
      setErrors({});
      onDone();
    } else {
      setErrors(result.errors ?? {});
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {isEdit && <input type="hidden" name="id" value={target.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم" htmlFor="u-name" required error={errors.name}>
          <Input
            id="u-name"
            name="name"
            defaultValue={target?.name ?? ""}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="u-email" required error={errors.email}>
          <Input
            id="u-email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={target?.email ?? ""}
            required
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="الدور"
        required
        error={errors.role}
        hint={
          isSelf
            ? "لا يمكنك تغيير دورك بنفسك — اسأل مدير النظام."
            : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <RadioCard
              key={role}
              id={`role-${role}`}
              name="role"
              value={role}
              defaultChecked={(target?.role ?? "EDITOR") === role}
              disabled={isSelf}
              label={ROLE_LABELS[role]}
              description={ROLE_DESCRIPTIONS[role]}
            />
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المسمى الوظيفي" htmlFor="u-job" optional>
          <Input
            id="u-job"
            name="jobTitle"
            defaultValue={target?.jobTitle ?? ""}
            placeholder="مثال: أخصائية علاج نفسي"
          />
        </Field>
        <Field label="رقم الجوال" htmlFor="u-phone" optional>
          <Input
            id="u-phone"
            name="phone"
            type="tel"
            dir="ltr"
            defaultValue={target?.phone ?? ""}
            placeholder="+966 5x xxx xxxx"
          />
        </Field>
      </div>

      {!isEdit && (
        <Field
          label="كلمة المرور"
          htmlFor="u-password"
          required
          error={errors.password}
          hint="10 أحرف على الأقل، وتشمل حرفًا ورقمًا، وليست كلمة شائعة."
        >
          <Input
            id="u-password"
            name="password"
            type="password"
            dir="ltr"
            required
            autoComplete="new-password"
          />
        </Field>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-sand-200 pt-4 dark:border-white/10">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          إلغاء
        </Button>
        <SubmitButton pending={pending} className="w-auto px-8">
          {isEdit ? "حفظ التعديلات" : "إنشاء المستخدم"}
        </SubmitButton>
      </div>
    </form>
  );
}

// ── Password form ─────────────────────────────────────────────

function PasswordForm({
  target,
  onDone,
}: {
  target: AdminUserRow;
  onDone: () => void;
}) {
  const { run, pending } = useAction();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      setErrors({ confirm: "كلمتا المرور غير متطابقتين." });
      return;
    }
    const result = await run(() => setUserPasswordAction(formData));
    if (result.ok) {
      setErrors({});
      onDone();
    } else {
      setErrors(result.errors ?? {});
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={target.id} />
      <p className="flex items-start gap-2 rounded-xl border border-warn-100 bg-warn-50 p-3 text-[0.8125rem] leading-relaxed text-warn-700 dark:border-warn-500/25 dark:bg-warn-500/10 dark:text-warn-500">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        تغيير كلمة المرور يُنهي كل جلسات هذا المستخدم على كل الأجهزة، وسيحتاج إلى تسجيل دخول
        جديد. لن تُعرض كلمة المرور الحالية في أي مكان.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="كلمة المرور الجديدة"
          htmlFor="p-new"
          required
          error={errors.password}
          hint="10 أحرف على الأقل، وتشمل حرفًا ورقمًا."
        >
          <Input
            id="p-new"
            name="password"
            type="password"
            dir="ltr"
            required
            autoComplete="new-password"
          />
        </Field>
        <Field label="تأكيد كلمة المرور" htmlFor="p-confirm" required error={errors.confirm}>
          <Input
            id="p-confirm"
            name="confirm"
            type="password"
            dir="ltr"
            required
            autoComplete="new-password"
          />
        </Field>
      </div>

      <div className="flex justify-end border-t border-sand-200 pt-4 dark:border-white/10">
        <SubmitButton pending={pending} className="w-auto px-8">
          تغيير كلمة المرور
        </SubmitButton>
      </div>
    </form>
  );
}

// ── Row actions ───────────────────────────────────────────────

function RowActions({
  row,
  currentUserId,
  canEdit,
  onEdit,
  onPassword,
}: {
  row: AdminUserRow;
  currentUserId: string;
  canEdit: boolean;
  onEdit: (row: AdminUserRow) => void;
  onPassword: (row: AdminUserRow) => void;
}) {
  const { run } = useAction();
  const isSelf = row.id === currentUserId;

  if (!canEdit) {
    return (
      <Link
        href={`/admin/users/${row.id}`}
        className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline dark:text-brand-300"
      >
        عرض الملف
      </Link>
    );
  }

  const toggle = async () => {
    const formData = new FormData();
    formData.set("id", row.id);
    formData.set("active", row.isActive ? "0" : "1");
    await run(() => toggleUserActiveAction(formData));
  };

  const remove = async () => {
    const formData = new FormData();
    formData.set("id", row.id);
    await run(() => deleteUserAction(formData));
  };

  const blockedReason = isSelf
    ? "لا يمكنك تعطيل حسابك بنفسك"
    : row.isLastSuperAdmin
      ? "آخر مدير عام في النظام"
      : null;

  const icon = row.isActive ? (
    <UserX className="size-3.5" aria-hidden />
  ) : (
    <UserCheck className="size-3.5" aria-hidden />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="soft" icon={Pencil} onClick={() => onEdit(row)}>
        تعديل
      </Button>
      <Button size="sm" variant="outline" icon={KeyRound} onClick={() => onPassword(row)}>
        كلمة المرور
      </Button>

      {blockedReason ? (
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-sand-100 px-3.5 py-1.5 text-xs font-bold text-ink-300 opacity-70 dark:bg-white/10 dark:text-ink-500" title={blockedReason}>
          {icon}
          {row.isActive ? "تعطيل" : "تفعيل"}
        </span>
      ) : (
        <ConfirmButton
          variant="outline"
          size="sm"
          onConfirm={toggle}
          confirmLabel="تأكيد التغيير"
          message={row.isActive ? "سيتم تعطيل الحساب وإنهاء جلساته." : "سيتم تفعيل الحساب."}
        >
          {row.isActive ? "تعطيل" : "تفعيل"}
        </ConfirmButton>
      )}

      {isSelf ? (
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-danger-50 px-3.5 py-1.5 text-xs font-bold text-danger-700 opacity-60 dark:bg-danger-500/15 dark:text-danger-500">
          حذف
        </span>
      ) : (
        <ConfirmButton
          variant="danger"
          size="sm"
          onConfirm={remove}
          confirmLabel="تأكيد الحذف"
          message={`سيُحذف حساب ${row.name} نهائيًا.`}
        >
          حذف
        </ConfirmButton>
      )}

      {blockedReason && (
        <span className="text-[0.6875rem] text-ink-400">{blockedReason}</span>
      )}
    </div>
  );
}

// ── Detail-page actions ──────────────────────────────────────

/** Buttons rendered on /admin/users/[id] — same forms, in a modal. */
export function UserDetailActions({
  user,
  canEdit,
  currentUserId,
}: {
  user: AdminUserRow;
  canEdit: boolean;
  currentUserId: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [passwordFor, setPasswordFor] = React.useState(false);

  if (!canEdit) return null;

  return (
    <>
      <Button icon={Pencil} onClick={() => setEditing(true)}>
        تعديل البيانات
      </Button>
      <Button variant="outline" icon={KeyRound} onClick={() => setPasswordFor(true)}>
        تغيير كلمة المرور
      </Button>

      {editing && (
        <Modal title={`تعديل: ${user.name}`} onClose={() => setEditing(false)}>
          <UserForm
            target={user}
            currentUserId={currentUserId}
            onDone={() => setEditing(false)}
          />
        </Modal>
      )}

      {passwordFor && (
        <Modal
          title={`كلمة مرور: ${user.name}`}
          description="سياسة المركز: 10 أحرف على الأقل مع حرف ورقم."
          onClose={() => setPasswordFor(false)}
        >
          <PasswordForm target={user} onDone={() => setPasswordFor(false)} />
        </Modal>
      )}
    </>
  );
}

// ── Manager ───────────────────────────────────────────────────

export function UsersManager({
  rows,
  currentUserId,
  canEdit,
}: {
  rows: AdminUserRow[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUserRow | null>(null);
  const [passwordFor, setPasswordFor] = React.useState<AdminUserRow | null>(null);

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      header: "الاسم",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <UserRound className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-brand-900 dark:text-white">{row.name}</p>
            {row.id === currentUserId && (
              <p className="text-[0.6875rem] text-ink-400">حسابك</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "البريد",
      cell: (row) => (
        <span dir="ltr" className="text-[0.8125rem] text-ink-600 dark:text-ink-300">
          {row.email}
        </span>
      ),
    },
    {
      key: "role",
      header: "الدور",
      cell: (row) => (
        <Badge tone={ROLE_TONES[row.role] ?? "brand"}>{ROLE_LABELS[row.role] ?? row.role}</Badge>
      ),
    },
    {
      key: "jobTitle",
      header: "المسمى الوظيفي",
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-[0.8125rem] text-ink-600 dark:text-ink-300">
          {row.jobTitle ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => (
        <Badge tone={row.isActive ? "success" : "danger"}>
          {row.isActive ? "مفعّل" : "معطّل"}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      header: "آخر دخول",
      hideBelow: "md",
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="text-[0.8125rem] text-ink-600 dark:text-ink-300">
            {timeAgo(row.lastLoginAt)}
          </span>
        ) : (
          <span className="text-[0.8125rem] text-ink-400">لم يسجّل دخولًا</span>
        ),
    },
    {
      key: "sessions",
      header: "الجلسات النشطة",
      hideBelow: "xl",
      cell: (row) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
            row.activeSessions > 0
              ? "bg-info-50 text-info-700 dark:bg-sky-500/15 dark:text-sky-200"
              : "bg-sand-100 text-ink-500 dark:bg-white/10 dark:text-ink-400",
          )}
        >
          {row.activeSessions}
        </span>
      ),
    },
    {
      key: "actions",
      header: "إجراءات",
      className: "whitespace-nowrap",
      cell: (row) => (
        <RowActions
          row={row}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onEdit={setEditing}
          onPassword={setPasswordFor}
        />
      ),
    },
  ];

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button icon={Plus} onClick={() => setCreating(true)}>
            مستخدم جديد
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        empty="لا يوجد مستخدمون مطابقون للبحث."
      />

      {creating && (
        <Modal
          title="إنشاء مستخدم جديد"
          description="سيستخدم البريد وكلمة المرور لتسجيل الدخول إلى لوحة التحكم."
          onClose={() => setCreating(false)}
        >
          <UserForm target={null} currentUserId={currentUserId} onDone={() => setCreating(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title={`تعديل: ${editing.name}`} onClose={() => setEditing(null)}>
          <UserForm
            target={editing}
            currentUserId={currentUserId}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}

      {passwordFor && (
        <Modal
          title={`كلمة مرور: ${passwordFor.name}`}
          description="سياسة المركز: 10 أحرف على الأقل مع حرف ورقم."
          onClose={() => setPasswordFor(null)}
        >
          <PasswordForm target={passwordFor} onDone={() => setPasswordFor(null)} />
        </Modal>
      )}
    </>
  );
}