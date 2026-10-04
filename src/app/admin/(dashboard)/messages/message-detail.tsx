"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  Globe2,
  Mail,
  MailOpen,
  MessageCircleQuestion,
  Phone,
  Reply,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { cn, formatDateTime, truncate } from "@/lib/utils";
import {
  deleteMessage,
  markRead,
  markUnread,
  toggleArchive,
} from "./actions";
import { ReplyForm } from "./reply-form";

/**
 * Detail pane of the inbox.
 *
 * Everything it renders arrives already decrypted by the server component that
 * authorised the request — encrypted columns never cross this boundary.
 */

export interface MessageDetailData {
  id: string;
  name: string;
  subject: string | null;
  topic: string | null;
  /** Decrypted + formatted for display. */
  phone: string | null;
  email: string | null;
  /** Decrypted message body — rendered as plain text. */
  body: string;
  isRead: boolean;
  isArchived: boolean;
  repliedAt: string | null;
  consentGivenAt: string | null;
  createdAt: string;
  /** Only populated for administrators. */
  ip: string | null;
  userAgent: string | null;
}

/** Opening a message is what marks it read. */
function MarkReadOnOpen({ id, isRead }: { id: string; isRead: boolean }) {
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (isRead || fired.current) return;
    fired.current = true;
    void markRead(id);
  }, [id, isRead]);
  return null;
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("00")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? `966${digits.slice(1)}`
      : digits;
  return `https://wa.me/${local}`;
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span className="text-[0.875rem] font-bold text-ink-800 dark:text-ink-100">
        {children}
      </span>
    </div>
  );
}

export function MessageDetail({
  message,
  canReply,
  showTechnical,
}: {
  message: MessageDetailData | null;
  canReply: boolean;
  showTechnical: boolean;
}) {
  const { run, pending } = useAction();
  const [replying, setReplying] = React.useState(false);

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-20 text-center dark:border-white/10 dark:bg-white/5">
        <MessageCircleQuestion className="size-8 text-ink-300" aria-hidden />
        <p className="font-bold text-ink-600 dark:text-ink-300">
          اختر رسالة من القائمة لعرضها هنا.
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-ink-400">
          الرسائل واردة من الموقع تحتوي بيانات شخصية حساسة، ولا تظهر إلا لمن يملك
          صلاحية الاطلاع على صندوق الرسائل.
        </p>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-4">
      <MarkReadOnOpen id={message.id} isRead={message.isRead} />

      <header className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-brand-900 dark:text-white">
                {message.name}
              </h2>
              {!message.isRead && <Badge tone="danger">غير مقروءة</Badge>}
              {message.repliedAt && <Badge tone="success">تم الرد عليها</Badge>}
              {message.isArchived && <Badge tone="warn">مؤرشفة</Badge>}
            </div>
            <p className="mt-1 text-[0.875rem] text-ink-600 dark:text-ink-300">
              {message.subject || "بدون موضوع"}
            </p>
          </div>
          <p className="text-xs text-ink-400">
            وردت في {formatDateTime(message.createdAt)}
          </p>
        </div>

        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact icon={User} label="الاسم">
            {message.name}
          </Fact>
          <Fact icon={Phone} label="الجوال">
            {message.phone ? (
              <a
                href={`tel:${message.phone.replace(/\s/g, "")}`}
                dir="ltr"
                className="inline-block hover:text-brand-700 hover:underline"
              >
                {message.phone}
              </a>
            ) : (
              <span className="text-ink-400">لم يُترك</span>
            )}
          </Fact>
          <Fact icon={Mail} label="البريد الإلكتروني">
            {message.email ? (
              <a
                href={`mailto:${message.email}`}
                dir="ltr"
                className="inline-block truncate hover:text-brand-700 hover:underline"
              >
                {message.email}
              </a>
            ) : (
              <span className="text-ink-400">لم يُترك</span>
            )}
          </Fact>
          <Fact icon={MailOpen} label="التصنيف">
            {message.topic ?? <span className="text-ink-400">غير محدد</span>}
          </Fact>
          <Fact icon={CheckCheck} label="موافقة الخصوصية">
            {message.consentGivenAt ? (
              formatDateTime(message.consentGivenAt)
            ) : (
              <span className="text-warn-700 dark:text-amber-300">لم تُسجَّل</span>
            )}
          </Fact>
          <Fact icon={Reply} label="آخر رد">
            {message.repliedAt ? (
              formatDateTime(message.repliedAt)
            ) : (
              <span className="text-ink-400">لم يُرد بعد</span>
            )}
          </Fact>
          {showTechnical && message.ip && (
            <>
              <Fact icon={Globe2} label="عنوان IP">
                <span dir="ltr">{message.ip}</span>
              </Fact>
              <Fact icon={ShieldCheck} label="المتصفح">
                <span
                  dir="ltr"
                  className="block max-w-xs truncate text-xs font-semibold text-ink-500"
                  title={message.userAgent ?? undefined}
                >
                  {message.userAgent || "غير معروف"}
                </span>
              </Fact>
            </>
          )}
        </dl>

        {/* ── Actions ───────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-sand-200 bg-sand-50 px-5 py-3 dark:border-white/10 dark:bg-white/5">
          {message.isRead ? (
            <ActionButton
              onClick={() => void run(() => markUnread(message.id))}
              disabled={pending}
              icon={Mail}
            >
              تعليم كغير مقروءة
            </ActionButton>
          ) : (
            <ActionButton
              onClick={() => void run(() => markRead(message.id))}
              disabled={pending}
              icon={MailOpen}
            >
              تعليم كمقروءة
            </ActionButton>
          )}

          <ActionButton
            onClick={() => void run(() => toggleArchive(message.id))}
            disabled={pending}
            icon={message.isArchived ? ArchiveRestore : Archive}
          >
            {message.isArchived ? "إلغاء الأرشفة" : "أرشفة"}
          </ActionButton>

          {message.phone && (
            <a
              href={whatsappHref(message.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15"
            >
              <Phone className="size-3.5" aria-hidden />
              واتساب
            </a>
          )}

          {canReply && message.email && (
            <ActionButton
              onClick={() => setReplying((value) => !value)}
              disabled={pending}
              icon={Reply}
              variant="primary"
            >
              {replying ? "إخفاء نموذج الرد" : "الرد على الرسالة"}
            </ActionButton>
          )}

          <span className="flex-1" />

          <ConfirmButton
            onConfirm={async () => {
              await run(() => deleteMessage(message.id));
            }}
            message="سيتم حذف الرسالة نهائيًا مع سجلها. هل أنت متأكد؟"
            confirmLabel="تأكيد الحذف"
          >
            <Trash2 className="size-3.5" aria-hidden />
            حذف
          </ConfirmButton>
        </div>
      </header>

      {/* ── Body (plain text, never HTML) ───────────── */}
      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
        <h3 className="mb-3 text-sm font-extrabold text-brand-900 dark:text-white">
          نص الرسالة
        </h3>
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-[2] text-ink-700 dark:text-ink-200">
          {message.body}
        </p>
      </section>

      {replying && message.email && (
        <ReplyForm
          messageId={message.id}
          toName={message.name}
          toEmail={message.email}
          subject={`رد: ${message.subject || message.topic || "رسالتك إلى سوار وعي"}`}
          quote={truncate(message.body, 240)}
          sentAt={formatDateTime(message.createdAt)}
          onCancel={() => setReplying(false)}
          onSent={() => setReplying(false)}
        />
      )}
    </article>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "primary";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors disabled:opacity-60",
        variant === "primary"
          ? "bg-brand-800 text-white hover:bg-brand-900"
          : "bg-sand-100 text-ink-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}