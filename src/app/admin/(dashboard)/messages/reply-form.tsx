"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/admin/use-action";
import { replyToMessage } from "./actions";

/**
 * Reply composer.
 *
 * The destination is the visitor's own address, so it stays visible and
 * editable — replying to the wrong person in a recovery centre is not a
 * mistake worth allowing by accident.
 */

function buildInitialBody(name: string, quote: string, sentAt: string): string {
  return [
    `مع السلامة ${name}،`,
    "",
    "اكتب ردك هنا…",
    "",
    "────────────────────────",
    sentAt ? `رسالتك الأصلية بتاريخ ${sentAt}:` : "رسالتك الأصلية:",
    quote,
  ].join("\n");
}

export function ReplyForm({
  messageId,
  toName,
  toEmail,
  subject,
  quote,
  sentAt,
  onCancel,
  onSent,
}: {
  messageId: string;
  toName: string;
  toEmail: string | null;
  subject: string;
  quote: string;
  sentAt: string;
  onCancel: () => void;
  onSent?: () => void;
}) {
  const { run, pending } = useAction();
  const [to, setTo] = React.useState(toEmail ?? "");
  const [replySubject, setReplySubject] = React.useState(subject);
  const [body, setBody] = React.useState(() => buildInitialBody(toName, quote, sentAt));
  const [errors, setErrors] = React.useState<{ to?: string; subject?: string; body?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      next.to = "أدخل بريدًا إلكترونيًا صالحًا للمُرسِل.";
    }
    if (replySubject.trim().length < 2) next.subject = "الموضوع مطلوب.";
    if (body.trim().length < 2) next.body = "نص الرد مطلوب.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const result = await run(
      () => replyToMessage({ id: messageId, to: to.trim(), subject: replySubject.trim(), body }),
      { successMessage: "تم إرسال الرد." },
    );
    if (result.ok) {
      setBody("");
      onSent?.();
    }
  };

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-500/30 dark:bg-white/5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-brand-900 dark:text-white">
            الرد على {toName}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            يُرسَل الرد إلى بريد المُرسِل، ويُسجَّل تلقائيًا كأنها مُرَدّ عليها.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="إغلاق نموذج الرد"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-white hover:text-ink-800 dark:hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="flex flex-col gap-4">
        <Field label="المُرسِل" htmlFor={`reply-to-${messageId}`} hint="لا يمكن تعديل بريد المُرسِل من لوحة التحكم.">
          <Input
            id={`reply-to-${messageId}`}
            type="email"
            dir="ltr"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={toEmail ?? "لا يوجد بريد مسجّل لهذه الرسالة"}
            invalid={Boolean(errors.to)}
            disabled={!toEmail}
          />
        </Field>

        <Field label="الموضوع" htmlFor={`reply-subject-${messageId}`} error={errors.subject ?? null} required>
          <Input
            id={`reply-subject-${messageId}`}
            value={replySubject}
            onChange={(event) => setReplySubject(event.target.value)}
            invalid={Boolean(errors.subject)}
          />
        </Field>

        <Field
          label="نص الرد"
          htmlFor={`reply-body-${messageId}`}
          error={errors.body ?? null}
          hint="اقتباس قصير من الرسالة الأصلية مرفق أسفل الرد ليسهل على المُرسّل تذكّر سياقها."
          required
        >
          <Textarea
            id={`reply-body-${messageId}`}
            rows={9}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            invalid={Boolean(errors.body)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void submit()}
            loading={pending}
            disabled={!toEmail}
            icon={Send}
            size="sm"
          >
            إرسال الرد
          </Button>
          <Button onClick={onCancel} variant="outline" size="sm" disabled={pending}>
            إلغاء
          </Button>
          {!toEmail && (
            <span className="text-xs font-semibold text-warn-700 dark:text-amber-300">
              لا يمكن الإرسال: المُرسِل لم يترك بريدًا إلكترونيًا.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}