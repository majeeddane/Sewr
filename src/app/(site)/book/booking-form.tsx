"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  User,
  Phone,
  Mail,
  CalendarDays,
  CheckCircle2,
  Send,
} from "lucide-react";
import { submitBookingForm, type FormResult } from "@/app/(site)/contact/actions";
import { Field, Input, Textarea, Select, Checkbox, Honeypot, RadioCard } from "@/components/ui/form";
import { SERVICE_INTERESTS } from "@/lib/validation";
import { CONTACT_METHODS } from "@/lib/enums";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-gold-500 px-8 text-base font-extrabold text-brand-950 shadow-[0_14px_32px_-16px_rgba(217,164,65,0.9)] transition-all duration-300 hover:bg-gold-400 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <Send className="size-4.5" aria-hidden />
      )}
      {pending ? "جارٍ إرسال الطلب…" : "أرسل طلب الحجز"}
    </button>
  );
}

const TIME_SLOTS = [
  "09:00", "10:00", "11:30", "12:30",
  "16:00", "17:00", "18:30", "20:00",
];

export function BookingForm({
  programs,
}: {
  programs: Array<{ slug: string; title: string }>;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    submitBookingForm,
    null,
  );
  const [website, setWebsite] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  // Kept in state rather than a ref so it can be read safely during render.
  const [startedAt, setStartedAt] = React.useState(0);

  React.useEffect(() => {
    const capture = () => {
      setStartedAt((current) => current || Date.now());
    };
    window.addEventListener("pointerdown", capture, { once: true });
    window.addEventListener("keydown", capture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", capture);
      window.removeEventListener("keydown", capture);
    };
  }, []);

  const today = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-3xl border border-success-100 bg-success-50 p-9 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-success-500/15 text-success-600">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-extrabold text-brand-900">تم استلام طلبك</h2>
        <p className="max-w-md text-[0.9375rem] leading-[1.95] text-ink-600">
          {state.message}
        </p>
      </div>
    );
  }

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Honeypot value={website} onChange={setWebsite} />
      <input type="hidden" name="formStartedAt" value={startedAt} />

      {/* 1 — identity */}
      <fieldset className="flex flex-col gap-5">
        <legend className="flex items-center gap-2.5 text-lg font-extrabold text-brand-900">
          <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-sm font-extrabold text-white">
            ١
          </span>
          بيانات التواصل
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="الاسم الكامل" htmlFor="b-name" required error={errors.fullName}>
            <Input
              id="b-name"
              name="fullName"
              required
              autoComplete="name"
              invalid={Boolean(errors.fullName)}
              iconStart={<User className="size-4" aria-hidden />}
              placeholder="محمد عبدالله"
            />
          </Field>

          <Field label="رقم الجوال" htmlFor="b-phone" required error={errors.phone}>
            <Input
              id="b-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              required
              autoComplete="tel"
              placeholder="05XXXXXXXX"
              invalid={Boolean(errors.phone)}
              iconStart={<Phone className="size-4" aria-hidden />}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="البريد الإلكتروني"
            htmlFor="b-email"
            optional
            error={errors.email}
            hint="مفيد إذا اخترت التواصل بالبريد."
          >
            <Input
              id="b-email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="name@example.com"
              invalid={Boolean(errors.email)}
              iconStart={<Mail className="size-4" aria-hidden />}
            />
          </Field>

          <Field label="المدينة" htmlFor="b-city" optional error={errors.city}>
            <Input
              id="b-city"
              name="city"
              autoComplete="address-level2"
              placeholder="الرياض"
              invalid={Boolean(errors.city)}
            />
          </Field>
        </div>
      </fieldset>

      {/* 2 — service */}
      <fieldset className="flex flex-col gap-5">
        <legend className="flex items-center gap-2.5 text-lg font-extrabold text-brand-900">
          <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-sm font-extrabold text-white">
            ٢
          </span>
          ما الذي تحتاجه؟
        </legend>

        <Field
          label="الخدمة المطلوبة"
          htmlFor="b-service"
          required
          error={errors.service}
        >
          <Select
            id="b-service"
            name="service"
            required
            defaultValue=""
            invalid={Boolean(errors.service)}
          >
            <option value="" disabled>
              اختر الخدمة
            </option>
            {SERVICE_INTERESTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        {programs.length > 0 && (
          <Field
            label="برنامج مفضّل"
            htmlFor="b-program"
            optional
            hint="اتركه فارغًا إن لم يكن لديك تصور مسبق."
          >
            <Select id="b-program" name="programId" defaultValue="">
              <option value="">بدون تفضيل محدد</option>
              {programs.map((program) => (
                <option key={program.slug} value={program.slug}>
                  {program.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </fieldset>

      {/* 3 — schedule */}
      <fieldset className="flex flex-col gap-5">
        <legend className="flex items-center gap-2.5 text-lg font-extrabold text-brand-900">
          <span className="grid size-8 place-items-center rounded-full bg-brand-800 text-sm font-extrabold text-white">
            ٣
          </span>
          الوقت المناسب لك
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="التاريخ المفضّل"
            htmlFor="b-date"
            required
            error={errors.preferredDate}
            hint="من غدًا حتى ستة أشهر قادمة."
          >
            <Input
              id="b-date"
              name="preferredDate"
              type="date"
              required
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              invalid={Boolean(errors.preferredDate)}
              iconStart={<CalendarDays className="size-4" aria-hidden />}
            />
          </Field>

          <Field
            label="الوقت المفضّل"
            htmlFor="b-time"
            optional
            error={errors.preferredTime}
            hint="وسنؤكد الموعد معك في النهاية."
          >
            <Select
              id="b-time"
              name="preferredTime"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              invalid={Boolean(errors.preferredTime)}
            >
              <option value="">أي وقت يناسبك</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot} dir="ltr">
                  {slot}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="طريقة التواصل المفضّلة"
          required
          error={errors.preferredContactMethod}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {CONTACT_METHODS.map((method, index) => (
              <RadioCard
                key={method.value}
                id={`method-${method.value}`}
                name="preferredContactMethod"
                value={method.value}
                defaultChecked={index === 0}
                label={method.label}
                description={
                  method.value === "WHATSAPP"
                    ? "الأسرع للرد."
                    : method.value === "EMAIL"
                      ? "مناسب للتواصل المكتوب."
                      : "نتصل بك في الموعد المتفق عليه."
                }
              />
            ))}
          </div>
        </Field>

        <Field
          label="ملاحظات إضافية"
          htmlFor="b-notes"
          optional
          error={errors.notes}
          hint="اختياري: أي تفاصيل تودّ إخبارنا بها مسبقًا."
        >
          <Textarea
            id="b-notes"
            name="notes"
            rows={4}
            maxLength={2000}
            placeholder="مثال: أفضّل اللقاء مساءً، أو لديّ عمل خلال النهار."
            invalid={Boolean(errors.notes)}
          />
        </Field>
      </fieldset>

      <Checkbox
        id="b-consent"
        name="consent"
        required
        defaultChecked={false}
        label="أوافق على سياسة الخصوصية"
        description={
          <>
            وأفهم أن بياناتي تُستخدم لتأكيد الموعد فقط، وفق{" "}
            <Link href="/privacy" className="font-bold text-brand-700 underline">
              سياسة الخصوصية
            </Link>
            .
          </>
        }
      />
      {errors.consent && (
        <p role="alert" className="text-[0.8125rem] font-semibold text-danger-600">
          {errors.consent}
        </p>
      )}

      {state && !state.ok && (
        <p
          role="alert"
          className="rounded-xl bg-danger-50 px-4 py-3 text-[0.8125rem] font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
        >
          {state.message}
        </p>
      )}

      <Submit />

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
        <CalendarDays className="size-3.5" aria-hidden />
        الحجز عبر الموقع طلب مبدئي، ونتواصل معك لتأكيد الموعد.
      </p>
    </form>
  );
}
