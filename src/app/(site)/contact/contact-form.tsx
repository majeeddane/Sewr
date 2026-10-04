"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  User,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
} from "lucide-react";
import { submitContactForm, type FormResult } from "./actions";
import { Field, Input, Textarea, Select, Checkbox, Honeypot } from "@/components/ui/form";
import { CONTACT_TOPICS } from "@/lib/validation";
import { cn } from "@/lib/utils";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-brand-800 px-8 py-4 text-base font-bold text-white shadow-[0_14px_32px_-16px_rgba(75,42,123,0.85)] transition-all duration-300 hover:bg-brand-900 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      ) : (
        <Send className="size-4.5" aria-hidden />
      )}
      {pending ? "جارٍ الإرسال…" : label}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    submitContactForm,
    null,
  );
  const [website, setWebsite] = React.useState("");
  // Captured on first interaction — used as a bot-timing heuristic. Kept in
  // state rather than a ref so it can be read safely during render.
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

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-2xl border border-success-100 bg-success-50 p-9 text-center"
      >
        <span className="grid size-16 place-items-center rounded-full bg-success-500/15 text-success-600">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-extrabold text-brand-900">وصلتنا رسالتك</h2>
        <p className="max-w-md text-[0.9375rem] leading-[1.95] text-ink-600">
          {state.message}
        </p>
      </div>
    );
  }

  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Honeypot value={website} onChange={setWebsite} />
      <input type="hidden" name="formStartedAt" value={startedAt} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="fullName" required error={errors.fullName}>
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            invalid={Boolean(errors.fullName)}
            iconStart={<User className="size-4" aria-hidden />}
            placeholder="محمد عبدالله"
          />
        </Field>

        <Field
          label="رقم الجوال"
          htmlFor="phone"
          required
          error={errors.phone}
          hint="سنستخدمه للتواصل معك فقط."
        >
          <Input
            id="phone"
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
          htmlFor="email"
          optional
          error={errors.email}
        >
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            invalid={Boolean(errors.email)}
            iconStart={<Mail className="size-4" aria-hidden />}
          />
        </Field>

        <Field label="سبب التواصل" htmlFor="topic" required error={errors.topic}>
          <Select id="topic" name="topic" required defaultValue="" invalid={Boolean(errors.topic)}>
            <option value="" disabled>
              اختر سبب التواصل
            </option>
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="الموضوع" htmlFor="subject" optional error={errors.subject}>
        <Input
          id="subject"
          name="subject"
          placeholder="عنوان مختصر للرسالة"
          invalid={Boolean(errors.subject)}
        />
      </Field>

      <Field label="رسالتك" htmlFor="message" required error={errors.message}>
        <Textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="اكتب ما تودّ قوله هنا. لا تذكر أسماء أشخاص آخرين حفاظًا على الخصوصية."
          invalid={Boolean(errors.message)}
        />
      </Field>

      <Checkbox
        id="consent"
        name="consent"
        required
        defaultChecked={false}
        label="أوافق على سياسة الخصوصية"
        description={
          <>
            وأفهم أن بياناتي تُعالَج لغرض الرد على طلبي فقط، وفق{" "}
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

      <Submit label="إرسال الرسالة" />

      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-400">
        <span aria-hidden>🔒</span>
        بياناتك مشفّرة ولا تُشارك مع أي جهة.
      </p>
    </form>
  );
}

/** Compact "how to reach us" card used on both /contact and /book. */
export function ContactChannels({
  phone,
  whatsappHref,
  email,
  hours,
  className,
}: {
  phone?: string | null;
  whatsappHref?: string | null;
  email?: string | null;
  hours: Array<{ day: string; hours: string }>;
  className?: string;
}) {
  const rows = [
    phone && {
      icon: PhoneCall,
      label: "الهاتف",
      value: phone,
      href: `tel:${phone}`,
    },
    whatsappHref && {
      icon: MessageCircle,
      label: "واتساب",
      value: "راسلنا مباشرة",
      href: whatsappHref,
    },
    email && {
      icon: Mail,
      label: "البريد الإلكتروني",
      value: email,
      href: `mailto:${email}`,
    },
  ].filter(Boolean) as Array<{
    icon: typeof PhoneCall;
    label: string;
    value: string;
    href: string;
  }>;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {rows.map((row) => (
            <li key={row.label}>
              <a
                href={row.href}
                target={row.href.startsWith("http") ? "_blank" : undefined}
                rel={row.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                  <row.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] text-ink-500">
                    {row.label}
                  </span>
                  <span
                    className="block truncate text-sm font-bold text-brand-900"
                    dir={row.label === "البريد الإلكتروني" || row.label === "الهاتف" ? "ltr" : undefined}
                  >
                    {row.value}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {hours.length > 0 && (
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-extrabold text-brand-900">ساعات العمل</h2>
          <dl className="mt-3.5 flex flex-col gap-2.5 text-[0.8125rem]">
            {hours.map((row) => (
              <div
                key={row.day}
                className="flex items-center justify-between gap-3 border-b border-sand-200 pb-2.5 last:border-0 last:pb-0"
              >
                <dt className="text-ink-500">{row.day}</dt>
                <dd className="font-bold text-brand-900">{row.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
