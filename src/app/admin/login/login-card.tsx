"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Mail, LockKeyhole, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Field, Input } from "@/components/ui/form";

function Submit() {
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
        <LogIn className="size-4.5" aria-hidden />
      )}
      {pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
    </button>
  );
}

export function LoginCard({ expired }: { expired: boolean }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="flex flex-col gap-5">
      {expired && (
        <p
          role="alert"
          className="rounded-xl bg-warn-50 px-4 py-3 text-[0.8125rem] font-semibold text-warn-700 ring-1 ring-inset ring-warn-100"
        >
          انتهت مدة الجلسة بسبب عدم النشاط. سجّل الدخول من جديد.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Field label="البريد الإلكتروني" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="username"
            required
            autoFocus
            placeholder="admin@sewrwaie.sa"
            iconStart={<Mail className="size-4" aria-hidden />}
            invalid={Boolean(state.error)}
          />
        </Field>

        <Field label="كلمة المرور" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            dir="ltr"
            autoComplete="current-password"
            required
            placeholder="••••••••••"
            iconStart={<LockKeyhole className="size-4" aria-hidden />}
            iconEnd={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="pointer-events-auto rounded-lg p-1 text-ink-400 transition-colors hover:text-brand-700"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            }
          />
        </Field>

        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-danger-50 px-4 py-3 text-[0.8125rem] font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
          >
            <span aria-hidden>⚠</span>
            {state.error}
          </p>
        )}

        <Submit />
      </form>

      <p className="flex items-center justify-center gap-1.5 border-t border-sand-200 pt-5 text-xs text-ink-400">
        <span aria-hidden>🔒</span>
        اتصال مشفّر · محاولات الدخول مراقَبة ومحدودة
      </p>
    </div>
  );
}
