"use server";

import { redirect } from "next/navigation";
import { loginWithPassword } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

/**
 * Server Action behind the login form.
 *
 * The heavy lifting (bcrypt compare, throttling, lockout, session creation)
 * lives in `lib/auth`. This wrapper only adapts the result for `useActionState`.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email.trim() || !password) {
    return { error: "أدخل البريد الإلكتروني وكلمة المرور." };
  }

  const result = await loginWithPassword(email, password);

  if (!result.ok) {
    return { error: result.error ?? "تعذّر تسجيل الدخول." };
  }

  // Never return from a successful login — always navigate.
  redirect("/admin");
}
