"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { useAction } from "@/components/admin/use-action";
import { ImagePicker } from "@/components/admin/image-picker";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import type { SimpleActionResult } from "./activity-tools";

/**
 * Client side of /admin/profile.
 *
 * Lives with the other dashboard client islands; the page hands it two Server
 * Actions so the session, the capability check and the hashing all stay on the
 * server.
 */

export interface ProfileValues {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

const MIN_PASSWORD_LENGTH = 10;

/** ── Details form ──────────────────────────────────────────── */

function ProfileDetailsForm({
  profile,
  onSave,
}: {
  profile: ProfileValues;
  onSave: (formData: FormData) => Promise<SimpleActionResult>;
}) {
  const { run, pending } = useAction();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(profile.avatarUrl);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("avatarUrl", avatarUrl ?? "");
    const result = await run(() => onSave(formData));
    if (result.ok) setErrors({});
    else setErrors(result.message ? { form: result.message } : {});
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <ImagePicker
          name="avatarUrl"
          label="الصورة الشخصية"
          value={avatarUrl}
          onChange={setAvatarUrl}
          folder="avatars"
          aspect="square"
          className="w-40"
          hint="مربّعة، 256×256 بكسل."
        />

        <div className="flex flex-col gap-4">
          <Field label="الاسم" htmlFor="p-name" required error={errors.name}>
            <Input id="p-name" name="name" defaultValue={profile.name} required />
          </Field>
          <Field
            label="المسمى الوظيفي"
            htmlFor="p-job"
            optional
            hint="يظهر بجانب اسمك في لوحة التحكم وسجل النشاط."
          >
            <Input
              id="p-job"
              name="jobTitle"
              defaultValue={profile.jobTitle ?? ""}
              placeholder="مثال: أخصائية علاج نفسي"
            />
          </Field>
          <Field label="رقم الجوال" htmlFor="p-phone" optional>
            <Input
              id="p-phone"
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={profile.phone ?? ""}
              placeholder="+966 5x xxx xxxx"
            />
          </Field>
        </div>
      </div>

      {errors.form && (
        <p className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-[0.8125rem] font-semibold text-danger-700 dark:border-danger-500/25 dark:bg-danger-500/10 dark:text-danger-500">
          {errors.form}
        </p>
      )}

      <div className="flex justify-end border-t border-sand-200 pt-4 dark:border-white/10">
        <SubmitButton pending={pending} className="w-auto px-8">
          حفظ البيانات
        </SubmitButton>
      </div>
    </form>
  );
}

/** ── Password form ────────────────────────────────────────── */

function ProfilePasswordForm({
  onChangePassword,
}: {
  onChangePassword: (formData: FormData) => Promise<SimpleActionResult>;
}) {
  const { run, pending } = useAction();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const next = String(formData.get("newPassword") ?? "");
    const repeat = String(formData.get("confirmPassword") ?? "");

    if (next !== repeat) {
      setErrors({ confirmPassword: "كلمتا المرور غير متطابقتين." });
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setErrors({ newPassword: `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف.` });
      return;
    }

    const result = await run(() => onChangePassword(formData));
    if (result.ok) {
      setErrors({});
      setPassword("");
      setConfirm("");
      (event.target as HTMLFormElement).reset();
    } else {
      setErrors({ form: result.message ?? "تعذّر تغيير كلمة المرور." });
    }
  };

  const strength = (value: string) => {
    if (!value) return null;
    if (value.length < MIN_PASSWORD_LENGTH) return { label: "قصيرة", tone: "bg-danger-500" };
    if (!/\d/.test(value) || !/[A-Za-zء-ي]/.test(value)) {
      return { label: "ناقصة", tone: "bg-warn-500" };
    }
    return { label: "جيدة", tone: "bg-success-500" };
  };

  const meter = strength(password);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-xl border border-warn-100 bg-warn-50 p-3 text-[0.8125rem] leading-relaxed text-warn-700 dark:border-warn-500/25 dark:bg-warn-500/10 dark:text-warn-500">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        تغيير كلمة المرور يُنهي جلساتك على بقية الأجهزة، وكلمة المرور الحالية لن تظهر في أي مكان.
      </p>

      <Field label="كلمة المرور الحالية" htmlFor="p-current" required>
        <Input
          id="p-current"
          name="currentPassword"
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="كلمة المرور الجديدة"
          htmlFor="p-new"
          required
          error={errors.newPassword}
          hint={`${MIN_PASSWORD_LENGTH} أحرف على الأقل، وتشمل حرفًا ورقمًا.`}
        >
          <Input
            id="p-new"
            name="newPassword"
            type="password"
            dir="ltr"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          label="تأكيد كلمة المرور الجديدة"
          htmlFor="p-confirm"
          required
          error={errors.confirmPassword}
        >
          <Input
            id="p-confirm"
            name="confirmPassword"
            type="password"
            dir="ltr"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
      </div>

      {meter && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${meter.tone}`}
              style={{ width: `${Math.min(100, (password.length / 20) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-ink-500">{meter.label}</span>
        </div>
      )}

      {errors.form && (
        <p className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-[0.8125rem] font-semibold text-danger-700 dark:border-danger-500/25 dark:bg-danger-500/10 dark:text-danger-500">
          {errors.form}
        </p>
      )}

      <div className="flex justify-end border-t border-sand-200 pt-4 dark:border-white/10">
        <SubmitButton pending={pending} className="w-auto px-8">
          تغيير كلمة المرور
        </SubmitButton>
      </div>
    </form>
  );
}

/** ── Public component ─────────────────────────────────────── */

export function ProfileForms({
  profile,
  onSaveProfile,
  onChangePassword,
}: {
  profile: ProfileValues;
  onSaveProfile: (formData: FormData) => Promise<SimpleActionResult>;
  onChangePassword: (formData: FormData) => Promise<SimpleActionResult>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ProfileDetailsForm profile={profile} onSave={onSaveProfile} />
      <ProfilePasswordForm onChangePassword={onChangePassword} />
    </div>
  );
}