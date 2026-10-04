"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Link2, Lock, Save, UserPlus } from "lucide-react";
import {
  Field,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { useAction } from "@/components/admin/use-action";
import { checkClientDuplicates, createClient, updateClient } from "./actions";
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_STYLES,
  CONTACT_METHODS,
  WHO_IS_ASKING,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/components/admin/use-action";

/**
 * Shared beneficiary form (create + edit).
 *
 * Sensitive data handling: this component only ever receives *decrypted display
 * strings* (`defaults.phone`, `defaults.email`, `defaults.notes`) produced by a
 * server component that already verified the `clients.view` capability. The
 * encrypted columns stay on the server, and every write re-encrypts from these
 * plain values. This is health data — never widen those props.
 */

export interface ClientFormValues {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  whoIsAsking: string;
  serviceInterest: string;
  programId: string;
  status: string;
  source: string;
  preferredContactMethod: string;
  assignedToId: string;
  notes: string;
}

/** A pre-existing record that shares the same phone / e-mail. */
export interface DuplicateHit {
  id: string;
  code: string;
  fullName: string;
  city: string;
  status: string;
}

export interface ClientActionResult extends ActionResult {
  id?: string;
  duplicates?: DuplicateHit[];
}

export interface ClientOption {
  id: string;
  label: string;
}

const EMPTY: ClientFormValues = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  whoIsAsking: "SELF",
  serviceInterest: "",
  programId: "",
  status: "NEW",
  source: "",
  preferredContactMethod: "PHONE",
  assignedToId: "",
  notes: "",
};

export function ClientForm({
  mode,
  clientId,
  defaults,
  programs = [],
  assignees = [],
  serviceSuggestions = [],
  citySuggestions = [],
  consentGivenAt = null,
}: {
  mode: "create" | "edit";
  clientId?: string;
  defaults?: Partial<ClientFormValues>;
  programs?: ClientOption[];
  assignees?: ClientOption[];
  serviceSuggestions?: string[];
  citySuggestions?: string[];
  /** Pre-formatted Arabic date — displayed read-only. */
  consentGivenAt?: string | null;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [values, setValues] = React.useState<ClientFormValues>({
    ...EMPTY,
    ...defaults,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = React.useState<DuplicateHit[]>([]);

  const set =
    (key: keyof ClientFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    };

  // ── Duplicate detection (warns, never blocks) ───────────────
  const lookupDuplicates = React.useCallback(
    async (phone: string, email: string) => {
      if (phone.length < 6 && !email.includes("@")) {
        setDuplicates([]);
        return;
      }
      const result = await checkClientDuplicates({
        phone,
        email,
        excludeId: clientId,
      });
      setDuplicates(result.duplicates ?? []);
    },
    [clientId],
  );

  // Debounced lookup. All state updates happen inside the timer callback, never
  // synchronously in the effect body.
  React.useEffect(() => {
    const phone = values.phone.trim();
    const email = values.email.trim();
    const timer = window.setTimeout(() => {
      void lookupDuplicates(phone, email);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [values.phone, values.email, lookupDuplicates]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    let result: ClientActionResult;
    if (mode === "create") {
      result = await run(() => createClient(values), {
        successMessage: "تم تسجيل المستفيد بنجاح.",
      });
    } else {
      result = await run(() => updateClient(clientId ?? "", values), {
        successMessage: "تم حفظ التعديلات.",
      });
    }

    if (!result.ok) {
      if (result.errors) setErrors(result.errors);
      return;
    }
    if (mode === "create" && result.id) {
      router.push(`/admin/clients/${result.id}`);
    } else {
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {/* ── Identity ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-sand-200 bg-sand-50/70 p-5 dark:border-white/10 dark:bg-white/5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-brand-900 dark:text-white">
          <UserPlus className="size-4 text-brand-600 dark:text-gold-300" aria-hidden />
          البيانات الأساسية
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="الاسم الكامل"
            htmlFor="client-fullName"
            required
            error={errors.fullName}
            className="sm:col-span-2"
          >
            <Input
              id="client-fullName"
              name="fullName"
              value={values.fullName}
              onChange={set("fullName")}
              invalid={Boolean(errors.fullName)}
              autoComplete="name"
              placeholder="مثال: عبدالله محمد الحربي"
            />
          </Field>

          <Field
            label="رقم الجوال"
            htmlFor="client-phone"
            required
            error={errors.phone}
            hint="يُخزَّن مشفّرًا في قاعدة البيانات."
          >
            <Input
              id="client-phone"
              name="phone"
              type="tel"
              dir="ltr"
              value={values.phone}
              onChange={set("phone")}
              invalid={Boolean(errors.phone)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="05XXXXXXXX"
            />
          </Field>

          <Field
            label="البريد الإلكتروني"
            htmlFor="client-email"
            error={errors.email}
            optional
          >
            <Input
              id="client-email"
              name="email"
              type="email"
              dir="ltr"
              value={values.email}
              onChange={set("email")}
              invalid={Boolean(errors.email)}
              autoComplete="email"
              placeholder="name@example.com"
            />
          </Field>

          <Field label="المدينة" htmlFor="client-city" error={errors.city} optional>
            <Input
              id="client-city"
              name="city"
              list="client-city-options"
              value={values.city}
              onChange={set("city")}
              invalid={Boolean(errors.city)}
              placeholder="الرياض"
            />
            <datalist id="client-city-options">
              {citySuggestions.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>

          <Field
            label="صفة مقدم الطلب"
            htmlFor="client-whoIsAsking"
            error={errors.whoIsAsking}
          >
            <Select
              id="client-whoIsAsking"
              name="whoIsAsking"
              value={values.whoIsAsking}
              onChange={set("whoIsAsking")}
              invalid={Boolean(errors.whoIsAsking)}
            >
              {WHO_IS_ASKING.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* ── Duplicates warning ────────────────────────────── */}
      {duplicates.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-warn-100 bg-warn-50 p-4 ring-1 ring-warn-100 dark:border-amber-400/25 dark:bg-amber-500/10 dark:ring-amber-400/20"
        >
          <p className="flex items-center gap-2 text-sm font-extrabold text-warn-700 dark:text-amber-200">
            <AlertTriangle className="size-4" aria-hidden />
            يوجد سجل مشابه بهذا الرقم أو البريد
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-600 dark:text-ink-300">
            يمكنك المتابعة — قد يكون الطلب نفسه مُسجّلًا مسبقًا. راجع الملفات التالية قبل
            الإضافة:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {duplicates.map((hit) => (
              <li key={hit.id}>
                <Link
                  href={`/admin/clients/${hit.id}`}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-inset ring-warn-100 transition-colors hover:bg-warn-50 dark:bg-white/5 dark:ring-amber-400/25 dark:hover:bg-white/10"
                >
                  <span dir="ltr" className="font-mono font-bold text-brand-700 dark:text-gold-300">
                    {hit.code}
                  </span>
                  <span className="font-bold text-ink-800 dark:text-white">{hit.fullName}</span>
                  {hit.city && <span className="text-ink-500">{hit.city}</span>}
                  <span className="inline-flex items-center gap-1 text-brand-700 dark:text-gold-300">
                    فتح الملف
                    <Link2 className="size-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Request ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-sand-200 bg-sand-50/70 p-5 dark:border-white/10 dark:bg-white/5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-brand-900 dark:text-white">
          <Info className="size-4 text-brand-600 dark:text-gold-300" aria-hidden />
          تفاصيل الطلب
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="الخدمة المطلوبة"
            htmlFor="client-service"
            error={errors.serviceInterest}
            optional
            hint="اكتب أي وصف للخدمة، أو اختر من القائمة."
          >
            <Input
              id="client-service"
              name="serviceInterest"
              list="client-service-options"
              value={values.serviceInterest}
              onChange={set("serviceInterest")}
              invalid={Boolean(errors.serviceInterest)}
              placeholder="جلسة استشارية فردية"
            />
            <datalist id="client-service-options">
              {serviceSuggestions.map((service) => (
                <option key={service} value={service} />
              ))}
            </datalist>
          </Field>

          <Field label="البرنامج" htmlFor="client-program" error={errors.programId} optional>
            <Select
              id="client-program"
              name="programId"
              value={values.programId}
              onChange={set("programId")}
              invalid={Boolean(errors.programId)}
            >
              <option value="">بدون برنامج محدد</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="الحالة" htmlFor="client-status" error={errors.status} required>
            <Select
              id="client-status"
              name="status"
              value={values.status}
              onChange={set("status")}
              invalid={Boolean(errors.status)}
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CLIENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <span
              aria-hidden
              className={cn(
                "mt-1 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset",
                CLIENT_STATUS_STYLES[values.status as keyof typeof CLIENT_STATUS_STYLES],
              )}
            >
              {CLIENT_STATUS_LABELS[values.status as keyof typeof CLIENT_STATUS_LABELS] ?? ""}
            </span>
          </Field>

          <Field
            label="مصدر الطلب"
            htmlFor="client-source"
            error={errors.source}
            optional
          >
            <Select
              id="client-source"
              name="source"
              value={values.source}
              onChange={set("source")}
              invalid={Boolean(errors.source)}
            >
              <option value="">غير محدد</option>
              {CLIENT_SOURCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="طريقة التواصل المفضّلة"
            htmlFor="client-contactMethod"
            error={errors.preferredContactMethod}
          >
            <Select
              id="client-contactMethod"
              name="preferredContactMethod"
              value={values.preferredContactMethod}
              onChange={set("preferredContactMethod")}
              invalid={Boolean(errors.preferredContactMethod)}
            >
              {CONTACT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="مسؤول الملف"
            htmlFor="client-assignedTo"
            error={errors.assignedToId}
            optional
          >
            <Select
              id="client-assignedTo"
              name="assignedToId"
              value={values.assignedToId}
              onChange={set("assignedToId")}
              invalid={Boolean(errors.assignedToId)}
            >
              <option value="">غير مُسند</option>
              {assignees.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* ── Notes + consent ───────────────────────────────── */}
      <section className="rounded-2xl border border-sand-200 bg-sand-50/70 p-5 dark:border-white/10 dark:bg-white/5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-brand-900 dark:text-white">
          <Lock className="size-4 text-brand-600 dark:text-gold-300" aria-hidden />
          ملاحظات سرّية
        </h3>

        <div className="mt-4 grid gap-4">
          <Field
            label="ملاحظات"
            htmlFor="client-notes"
            error={errors.notes}
            optional
            hint="تُخزَّن مشفّرة، ولا تظهر إلا لمن يملك صلاحية عرض المستفيدين."
          >
            <Textarea
              id="client-notes"
              name="notes"
              rows={5}
              value={values.notes}
              onChange={set("notes")}
              invalid={Boolean(errors.notes)}
              placeholder="أي سياق يهمّ المتابعة: التكرار، الاحتياجات، ملاحظات جلسات الإحاطة…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs text-ink-600 ring-1 ring-inset ring-sand-200 dark:bg-white/5 dark:text-ink-300 dark:ring-white/10">
            <Lock className="size-3.5 text-brand-600 dark:text-gold-300" aria-hidden />
            <span className="font-bold">تاريخ الموافقة على الخصوصية:</span>
            <span>{consentGivenAt ?? "غير مسجّل"}</span>
            <span className="ms-auto text-ink-400">يُسجَّل تلقائيًا عند إضافة المستفيد.</span>
          </div>
        </div>
      </section>

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-sand-200 pt-5 dark:border-white/10">
        <SubmitButton
          pending={pending}
          className={cn("w-auto px-8", pending && "cursor-wait")}
          data-testid="client-submit"
        >
          <Save className="size-4" aria-hidden />
          {mode === "create" ? "تسجيل المستفيد" : "حفظ التعديلات"}
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/clients")}
        >
          إلغاء والعودة للقائمة
        </Button>
      </div>
    </form>
  );
}
