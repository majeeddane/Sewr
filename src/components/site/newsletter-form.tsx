"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { subscribeToNewsletter } from "@/app/(site)/contact/actions";
/**
 * Lightweight newsletter sign-up.
 *
 * There is no marketing-mail integration, so this writes into the same
 * contact-messages table with a dedicated topic — the team can review or export
 * it from the dashboard. That keeps the promise in the footer honest without an
 * extra integration.
 */
export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setMessage("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    setState("loading");
    try {
      const data = await subscribeToNewsletter(email);
      if (data.ok) {
        setState("done");
        setMessage(data.message ?? "تم تسجيل اشتراكك، شكرًا لك.");
        setEmail("");
      } else {
        setState("error");
        setMessage(data.message ?? "تعذّر إتمام الاشتراك، حاول لاحقًا.");
      }
    } catch {
      setState("error");
      setMessage("تعذّر الاتصال، حاول لاحقًا.");
    }
  };

  if (state === "done") {
    return (
      <p
        role="status"
        className="rounded-2xl bg-success-500/15 px-5 py-4 text-sm font-bold text-emerald-200 ring-1 ring-inset ring-emerald-300/25"
      >
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5" noValidate>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          بريدك الإلكتروني
        </label>
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          dir="ltr"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="h-12 flex-1 rounded-full border border-white/15 bg-white/8 px-5 text-start text-[0.9375rem] text-white placeholder:text-brand-300/70 focus:border-gold-400 focus:outline-none focus:ring-4 focus:ring-gold-400/15"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gold-500 px-7 text-[0.9375rem] font-bold text-brand-950 transition-all hover:bg-gold-400 active:scale-[0.98] disabled:opacity-60"
        >
          {state === "loading" ? (
            <span
              aria-hidden
              className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          اشترك
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-[0.8125rem] font-semibold text-rose-300">
          {message}
        </p>
      )}
      <p className="text-xs leading-relaxed text-brand-300/80">
        بالاشتراك أنت توافق على معالجة بريدك لغرض إرسال النشرة فقط، ويمكنك
        إلغاء الاشتراك في أي وقت.
      </p>
    </form>
  );
}
