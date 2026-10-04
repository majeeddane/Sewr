"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Heading2,
  Italic,
  List,
  Loader2,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  Save,
  Star,
  Trash2,
  Wand2,
} from "lucide-react";
import { IconGlyph, IconPicker } from "./icon-picker";
import { ImagePicker } from "@/components/admin/image-picker";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { Panel } from "@/components/admin/widgets";
import { Badge, Button, IconChip, chipToneFor } from "@/components/ui/primitives";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Prose } from "@/components/site/common";
import { slugify } from "@/lib/utils";
import {
  deleteContentItem,
  reorderContentItems,
  saveContentItem,
  toggleContentItem,
} from "../actions";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface StepValue {
  title: string;
  description: string;
}

export interface FaqValue {
  question: string;
  answer: string;
}

export interface ContentFormValue {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  icon: string;
  image: string;
  imageAlt: string;
  audience: string;
  steps: StepValue[];
  benefits: string[];
  outcomes: string[];
  notes: string[];
  faqs: FaqValue[];
  durationLabel: string;
  seoTitle: string;
  seoDescription: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
}

export function emptyContentForm(): ContentFormValue {
  return {
    title: "",
    slug: "",
    shortDescription: "",
    fullDescription: "",
    icon: "",
    image: "",
    imageAlt: "",
    audience: "",
    steps: [],
    benefits: [],
    outcomes: [],
    notes: [],
    faqs: [],
    durationLabel: "",
    seoTitle: "",
    seoDescription: "",
    order: 0,
    isActive: true,
    isFeatured: false,
  };
}

const MAX_STEPS = 10;
const MAX_LIST_ROWS = 20;
const MAX_FAQS = 20;

// ═══════════════════════════════════════════════════════════════
//  Rich text — textarea + a tiny formatting toolbar
// ═══════════════════════════════════════════════════════════════

/** Toolbar buttons — declared at module scope so no closures are built in render. */
const TOOLS = [
  { key: "bold", label: "غامق", icon: Bold },
  { key: "italic", label: "مائل", icon: Italic },
  { key: "h2", label: "عنوان", icon: Heading2 },
  { key: "p", label: "فقرة", icon: Pilcrow },
  { key: "ul", label: "قائمة", icon: List },
  { key: "quote", label: "اقتباس", icon: Quote },
] as const;

type ToolKey = (typeof TOOLS)[number]["key"];

/**
 * The dashboard deliberately avoids a heavy WYSIWYG dependency here: editors
 * get a plain textarea plus a toolbar that wraps the current selection in the
 * same handful of tags the public `.prose-ar` stylesheet knows about. Whatever
 * comes out of here is passed through `sanitizeRichText()` on the server before
 * it is ever stored, so hand-pasted markup cannot smuggle scripts in.
 */
function RichTextArea({
  value,
  onChange,
  id = "fullDescription",
  rows = 16,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const replaceRange = React.useCallback(
    (start: number, end: number, insert: string, selectFrom: number, selectTo: number) => {
      const el = ref.current;
      const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
      onChange(next);
      window.requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(selectFrom, selectTo);
      });
    },
    [onChange, value],
  );

  const wrap = React.useCallback(
    (before: string, after: string, placeholder: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      const inner = selected.trim().length ? selected : placeholder;
      const insert = `${before}${inner}${after}`;
      replaceRange(start, end, insert, start + before.length, start + before.length + inner.length);
    },
    [replaceRange, value],
  );

  const listify = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const lines = (selected.trim().length ? selected : "عنصر جديد")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const insert = `<ul>\n${lines.map((line) => `  <li>${line}</li>`).join("\n")}\n</ul>`;
    replaceRange(start, end, insert, start, start + insert.length);
  }, [replaceRange, value]);

  const strip = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const hasSelection = value.slice(start, end).trim().length > 0;
    const source = hasSelection ? value.slice(start, end) : value;
    const insert = source.replace(/<[^>]+>/g, "");
    const from = hasSelection ? start : 0;
    const to = hasSelection ? end : value.length;
    replaceRange(from, to, insert, from, from + insert.length);
  }, [replaceRange, value]);

  /** Single dispatcher keeps every handler stable across renders. */
  const applyTool = React.useCallback(
    (key: ToolKey) => {
      switch (key) {
        case "bold":
          wrap("<strong>", "</strong>", "نص غامق");
          break;
        case "italic":
          wrap("<em>", "</em>", "نص مائل");
          break;
        case "h2":
          wrap("<h2>", "</h2>", "عنوان فرعي");
          break;
        case "p":
          wrap("<p>", "</p>", "فقرة");
          break;
        case "ul":
          listify();
          break;
        case "quote":
          wrap("<blockquote>", "</blockquote>", "اقتباس");
          break;
      }
    },
    [listify, wrap],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sand-200 bg-sand-50 p-2 dark:border-white/10 dark:bg-white/5">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            onClick={() => applyTool(tool.key)}
            disabled={disabled}
            title={tool.label}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[0.6875rem] font-bold text-ink-600 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 hover:text-brand-800 disabled:opacity-50 dark:bg-white/10 dark:text-ink-400 dark:ring-white/10 dark:hover:bg-white/15"
          >
            <tool.icon className="size-3.5" aria-hidden />
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          onClick={strip}
          disabled={disabled}
          title="إزالة التنسيق من التحديد"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[0.6875rem] font-bold text-ink-600 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-warn-50 hover:text-warn-700 disabled:opacity-50 dark:bg-white/10 dark:text-ink-400 dark:ring-white/10 dark:hover:bg-warn-500/20"
        >
          <Wand2 className="size-3.5" aria-hidden />
          نص عادي
        </button>
      </div>

      <textarea
        ref={ref}
        id={id}
        name={id}
        dir="rtl"
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="اكتب الوصف الكامل هنا… استخدم شريط الأدوات أعلاه لإضافة العناوين والقوائم والاقتباسات."
        className="w-full resize-y rounded-xl border border-sand-300 bg-white px-4 py-3 font-mono text-[0.8125rem] leading-[2] text-ink-900 shadow-sm placeholder:font-sans placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 disabled:bg-sand-100 dark:border-white/15 dark:bg-white/5 dark:text-ink-400 dark:placeholder:text-ink-500"
      />
      <p className="text-[0.8125rem] leading-relaxed text-ink-500">
        الوسوم المتاحة: <code className="font-mono text-xs">h2</code> ·{" "}
        <code className="font-mono text-xs">strong</code> ·{" "}
        <code className="font-mono text-xs">em</code> ·{" "}
        <code className="font-mono text-xs">ul/li</code> ·{" "}
        <code className="font-mono text-xs">blockquote</code> — يتم تنقية النص تلقائيًا
        قبل الحفظ.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Repeaters
// ═══════════════════════════════════════════════════════════════

function StringListRepeater({
  label,
  hint,
  values,
  onChange,
  max = MAX_LIST_ROWS,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink-800">{label}</span>
        <button
          type="button"
          disabled={disabled || values.length >= max}
          onClick={() => onChange([...values, ""])}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 transition-colors hover:bg-brand-100 disabled:opacity-50 dark:bg-white/10 dark:text-brand-100 dark:hover:bg-white/15"
        >
          <Plus className="size-3.5" aria-hidden />
          إضافة سطر
        </button>
      </div>

      {values.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-300 px-4 py-5 text-center text-xs font-bold text-ink-400 dark:border-white/15">
          لا توجد عناصر بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {values.map((value, index) => (
            <li key={index} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-3 grid size-7 shrink-0 place-items-center rounded-lg bg-sand-100 text-[0.6875rem] font-extrabold text-ink-500 dark:bg-white/10 dark:text-ink-400"
              >
                {index + 1}
              </span>
              <Input
                value={value}
                disabled={disabled}
                placeholder={placeholder ?? "اكتب العنصر…"}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  onChange(next);
                }}
                className="h-11 flex-1"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                aria-label={`حذف السطر ${index + 1}`}
                className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <p className="text-[0.8125rem] text-ink-500">{hint}</p>}
    </div>
  );
}

function StepsRepeater({
  values,
  onChange,
  disabled,
}: {
  values: StepValue[];
  onChange: (next: StepValue[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink-800">خطوات الجلسة / البرنامج</span>
        <button
          type="button"
          disabled={disabled || values.length >= MAX_STEPS}
          onClick={() => onChange([...values, { title: "", description: "" }])}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 transition-colors hover:bg-brand-100 disabled:opacity-50 dark:bg-white/10 dark:text-brand-100 dark:hover:bg-white/15"
        >
          <Plus className="size-3.5" aria-hidden />
          إضافة خطوة
        </button>
      </div>

      {values.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-300 px-4 py-5 text-center text-xs font-bold text-ink-400 dark:border-white/15">
          لم تُضف خطوات بعد — الحد الأقصى ١٠ خطوات.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {values.map((step, index) => (
            <li
              key={index}
              className="rounded-xl border border-sand-200 bg-sand-50 p-3.5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-800 text-[0.6875rem] font-extrabold text-white">
                  {index + 1}
                </span>
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => {
                    const next = [...values];
                    const [moved] = next.splice(index, 1);
                    next.splice(index - 1, 0, moved!);
                    onChange(next);
                  }}
                  aria-label="تحريك الخطوة لأعلى"
                  className="grid size-7 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-brand-700 disabled:opacity-35 dark:hover:bg-white/10"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === values.length - 1}
                  onClick={() => {
                    const next = [...values];
                    const [moved] = next.splice(index, 1);
                    next.splice(index + 1, 0, moved!);
                    onChange(next);
                  }}
                  aria-label="تحريك الخطوة لأسفل"
                  className="grid size-7 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-brand-700 disabled:opacity-35 dark:hover:bg-white/10"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(values.filter((_, i) => i !== index))}
                  aria-label="حذف الخطوة"
                  className="ms-auto grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                <Input
                  value={step.title}
                  disabled={disabled}
                  placeholder="عنوان الخطوة"
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = { ...step, title: event.target.value };
                    onChange(next);
                  }}
                  className="h-11"
                />
                <Textarea
                  rows={3}
                  value={step.description}
                  disabled={disabled}
                  placeholder="ماذا يحدث في هذه الخطوة؟"
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = { ...step, description: event.target.value };
                    onChange(next);
                  }}
                  className="text-[0.875rem]"
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FaqRepeater({
  values,
  onChange,
  disabled,
}: {
  values: FaqValue[];
  onChange: (next: FaqValue[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink-800">أسئلة شائعة خاصة بهذا العنصر</span>
        <button
          type="button"
          disabled={disabled || values.length >= MAX_FAQS}
          onClick={() => onChange([...values, { question: "", answer: "" }])}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 transition-colors hover:bg-brand-100 disabled:opacity-50 dark:bg-white/10 dark:text-brand-100 dark:hover:bg-white/15"
        >
          <Plus className="size-3.5" aria-hidden />
          إضافة سؤال
        </button>
      </div>

      {values.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-300 px-4 py-5 text-center text-xs font-bold text-ink-400 dark:border-white/15">
          لا توجد أسئلة مرتبطة بهذا العنصر.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {values.map((faq, index) => (
            <li
              key={index}
              className="rounded-xl border border-sand-200 bg-sand-50 p-3.5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <Input
                    value={faq.question}
                    disabled={disabled}
                    placeholder="السؤال"
                    onChange={(event) => {
                      const next = [...values];
                      next[index] = { ...faq, question: event.target.value };
                      onChange(next);
                    }}
                    className="h-11 flex-1"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(values.filter((_, i) => i !== index))}
                    aria-label="حذف السؤال"
                    className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <Textarea
                  rows={3}
                  value={faq.answer}
                  disabled={disabled}
                  placeholder="الإجابة"
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = { ...faq, answer: event.target.value };
                    onChange(next);
                  }}
                  className="text-[0.875rem]"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Live preview — mirrors the public detail page
// ═══════════════════════════════════════════════════════════════

function ContentPreview({
  value,
  typeLabel,
}: {
  value: ContentFormValue;
  typeLabel: string;
}) {
  const hasBody = value.fullDescription.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white dark:border-white/10 dark:bg-white/5">
      <p className="flex items-center gap-1.5 border-b border-sand-200 bg-warn-50 px-4 py-2 text-[0.6875rem] font-bold text-warn-700 dark:border-white/10 dark:bg-warn-500/10 dark:text-warn-500">
        <Eye className="size-3.5" aria-hidden />
        معاينة تقريبية — تخطيط الصفحة العامة
      </p>

      {/* Hero */}
      <div className="relative overflow-hidden bg-brand-950 px-5 py-8">
        <div aria-hidden className="absolute inset-0 bg-dots opacity-30" />
        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">{typeLabel}</Badge>
            {value.durationLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[0.6875rem] font-bold text-gold-300 ring-1 ring-inset ring-white/15">
                {value.durationLabel}
              </span>
            )}
          </div>
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-gold-300 ring-1 ring-inset ring-white/20">
              <IconGlyph name={value.icon} className="size-6" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xl leading-tight font-extrabold text-white">
                {value.title || "عنوان العنصر"}
              </h3>
              {value.slug && (
                <p className="mt-1 font-mono text-[0.6875rem] text-brand-300" dir="ltr">
                  /{value.slug}
                </p>
              )}
            </div>
          </div>
          {value.shortDescription && (
            <p className="max-w-2xl text-sm leading-[2] text-brand-100">
              {value.shortDescription}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 p-5">
        <div>
          <h4 className="mb-2 text-sm font-extrabold text-brand-900 dark:text-white">
            الوصف الكامل
          </h4>
          {hasBody ? (
            <Prose html={value.fullDescription} />
          ) : (
            <p className="rounded-xl border border-dashed border-sand-300 px-4 py-6 text-center text-xs font-bold text-ink-400 dark:border-white/15">
              لم تُكتب وصف بعد.
            </p>
          )}
        </div>

        {value.audience.trim() && (
          <section>
            <h4 className="mb-2 text-sm font-extrabold text-brand-900 dark:text-white">
              من تناسب هذه الخدمة؟
            </h4>
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-[2] text-brand-900 dark:bg-white/5 dark:text-brand-100">
              {value.audience}
            </p>
          </section>
        )}

        {value.steps.filter((step) => step.title || step.description).length > 0 && (
          <section>
            <h4 className="mb-3 text-sm font-extrabold text-brand-900 dark:text-white">
              كيف تسير الجلسة
            </h4>
            <ol className="flex flex-col gap-3">
              {value.steps
                .filter((step) => step.title || step.description)
                .map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-800 text-xs font-extrabold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink-900 dark:text-white">
                        {step.title}
                      </p>
                      {step.description && (
                        <p className="mt-1 text-[0.8125rem] leading-[1.9] text-ink-600 dark:text-ink-400">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        )}

        {(["benefits", "outcomes", "notes"] as const).map((key) => {
          const rows = value[key].filter((item) => item.trim());
          if (!rows.length) return null;
          const heading =
            key === "benefits" ? "ماذا تحقق" : key === "outcomes" ? "مخرجات متوقعة" : "ملاحظات مهنية";
          return (
            <section key={key}>
              <h4 className="mb-2 text-sm font-extrabold text-brand-900 dark:text-white">
                {heading}
              </h4>
              <ul className="prose-ar">
                {rows.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          );
        })}

        {value.faqs.filter((faq) => faq.question.trim()).length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-extrabold text-brand-900 dark:text-white">
              الأسئلة الشائعة
            </h4>
            <div className="flex flex-col gap-2">
              {value.faqs
                .filter((faq) => faq.question.trim())
                .map((faq, index) => (
                  <details
                    key={index}
                    className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <summary className="cursor-pointer text-sm font-bold text-brand-900 dark:text-white">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-[0.8125rem] leading-[1.9] text-ink-600 dark:text-ink-400">
                      {faq.answer}
                    </p>
                  </details>
                ))}
            </div>
          </section>
        )}

        <p className="border-t border-sand-200 pt-3 text-[0.6875rem] text-ink-400 dark:border-white/10">
          عنوان SEO: {value.seoTitle || "—"} · وصف SEO: {value.seoDescription || "—"}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  The editor form
// ═══════════════════════════════════════════════════════════════

export function ContentForm({
  type,
  typeLabel,
  id,
  initial,
  canEdit,
}: {
  type: string;
  typeLabel: string;
  id?: string;
  /** Omit for a brand-new item — the empty draft is built client-side. */
  initial?: ContentFormValue;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = React.useState<ContentFormValue>(() => initial ?? emptyContentForm());
  const [preview, setPreview] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial?.slug));

  const set = <K extends keyof ContentFormValue>(key: K, value: ContentFormValue[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const result = await run(
      () =>
        saveContentItem({
          id: id ?? null,
          type,
          title: form.title,
          slug: form.slug,
          shortDescription: form.shortDescription,
          fullDescription: form.fullDescription,
          icon: form.icon || null,
          image: form.image || null,
          imageAlt: form.imageAlt || null,
          audience: form.audience || null,
          steps: form.steps,
          benefits: form.benefits,
          outcomes: form.outcomes,
          notes: form.notes,
          faqs: form.faqs,
          durationLabel: form.durationLabel || null,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
          order: Number.isFinite(form.order) ? form.order : 0,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
        }),
      {
        successMessage: id ? "تم حفظ التعديلات." : "تمت الإضافة بنجاح.",
        onSuccess: () => {
          if (!id) router.push(`/admin/content/${type}`);
        },
      },
    );
    if (result.ok) setSlugTouched(true);
  };

  const disabled = !canEdit || pending;

  return (
    // A real <form> so pressing Enter in any text field saves the draft.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) void submit();
      }}
      className="flex flex-col gap-5"
    >
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-2xl border border-warn-100 bg-warn-50 px-4 py-3 text-sm font-bold text-warn-700 dark:border-warn-500/20 dark:bg-warn-500/10 dark:text-warn-500">
          لا تملك صلاحية تعديل المحتوى — العرض للقراءة فقط.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={form.isActive ? "success" : "danger"}>
            {form.isActive ? "مفعّل" : "معطّل"}
          </Badge>
          {form.isFeatured && <Badge tone="gold">مميّز على الرئيسية</Badge>}
        </div>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          aria-pressed={preview}
          className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3.5 py-1.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-400 dark:ring-white/10 dark:hover:bg-white/15"
        >
          {preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {preview ? "إخفاء المعاينة" : "معاينة حية"}
        </button>
      </div>

      <div
        className={
          preview
            ? "grid gap-5 xl:grid-cols-2 xl:items-start"
            : "flex flex-col gap-5"
        }
      >
        {/* ── Editor ─────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <Panel title="البيانات الأساسية" description="العنوان والرابط والوصف الذي يظهر في البطاقات.">
            <div className="flex flex-col gap-4">
              <Field label="العنوان" htmlFor="title" required>
                <Input
                  id="title"
                  value={form.title}
                  disabled={disabled}
                  placeholder="مثال: جلسة إرشاد تعافي"
                  onChange={(event) => {
                    const title = event.target.value;
                    setForm((current) => ({
                      ...current,
                      title,
                      slug: slugTouched ? current.slug : slugify(title),
                    }));
                  }}
                />
              </Field>

              <Field
                label="الرابط (slug)"
                htmlFor="slug"
                hint="يُستخدم في رابط الصفحة العامة. يُنشأ تلقائيًا من العنوان، ويجب أن يكون فريدًا داخل هذا القسم."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="slug"
                    dir="ltr"
                    value={form.slug}
                    disabled={disabled}
                    placeholder="session-recovery"
                    onChange={(event) => {
                      setSlugTouched(true);
                      set("slug", slugify(event.target.value));
                    }}
                    className="flex-1 font-mono text-[0.875rem]"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => set("slug", slugify(form.title))}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 disabled:opacity-50 dark:bg-white/10 dark:text-ink-400 dark:ring-white/10"
                  >
                    <Wand2 className="size-3.5" aria-hidden />
                    توليد
                  </button>
                </div>
              </Field>

              <Field
                label="الوصف المختصر"
                htmlFor="shortDescription"
                required
                hint="سطر أو سطران يظهران في بطاقات صفحة القسم."
              >
                <Textarea
                  id="shortDescription"
                  rows={3}
                  value={form.shortDescription}
                  disabled={disabled}
                  placeholder="مثال: جلسة فردية تساعد على فهم نمط الإدمان خطوة بخطوة."
                  onChange={(event) => set("shortDescription", event.target.value)}
                />
              </Field>

              <Field label="مدة الجلسات" htmlFor="durationLabel" optional>
                <Input
                  id="durationLabel"
                  value={form.durationLabel}
                  disabled={disabled}
                  placeholder="مثال: ٥٠ دقيقة · جلسات أسبوعية"
                  onChange={(event) => set("durationLabel", event.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="الوصف الكامل"
            description="النص الطويل الذي يظهر في صفحة التفاصيل. يدعم عناوين وقوائم واقتباسات بسيطة."
          >
            <RichTextArea
              value={form.fullDescription}
              disabled={disabled}
              onChange={(value) => set("fullDescription", value)}
            />
          </Panel>

          <Panel title="من تناسب هذه الخدمة؟" description="يظهر كقسم مميّز في صفحة التفاصيل.">
            <Textarea
              rows={4}
              value={form.audience}
              disabled={disabled}
              placeholder="مثال: كل من يريد فهم العلاقة بين الضغط النفسي والسلوك اليومي، والمتعافون الذين يحتاجون خطة عملية."
              onChange={(event) => set("audience", event.target.value)}
            />
          </Panel>

          <Panel title="خطوات الجلسة" description={`حتى ${MAX_STEPS} خطوات، تظهر بالترتيب.`}>
            <StepsRepeater
              values={form.steps}
              disabled={disabled}
              onChange={(next) => set("steps", next)}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="ماذا تحقق" description="قائمة benefitsJson">
              <StringListRepeater
                label="نقاط الفوائد"
                values={form.benefits}
                disabled={disabled}
                placeholder="مثال: هدوء داخلي أعلى"
                onChange={(next) => set("benefits", next)}
              />
            </Panel>
            <Panel title="مخرجات متوقعة" description="قائمة outcomesJson">
              <StringListRepeater
                label="المخرجات"
                values={form.outcomes}
                disabled={disabled}
                placeholder="مثال: خطة عملية للتعامل مع الرغبة"
                onChange={(next) => set("outcomes", next)}
              />
            </Panel>
          </div>

          <Panel title="ملاحظات مهنية" description="قائمة notesJson — تظهر كإطار نصي تحذيري.">
            <StringListRepeater
              label="الملاحظات"
              values={form.notes}
              disabled={disabled}
              placeholder="مثال: لا يُغني عن العلاج الطبي"
              onChange={(next) => set("notes", next)}
            />
          </Panel>

          <Panel
            title="أسئلة شائعة مرتبطة"
            description="تظهر في نهاية صفحة التفاصيل تحت قسم خاص بهذا العنصر."
          >
            <FaqRepeater
              values={form.faqs}
              disabled={disabled}
              onChange={(next) => set("faqs", next)}
            />
          </Panel>

          <Panel title="الصورة والأيقونة" description="الصور اختيارية — يوجد بديل متدرّج بالأيقونة.">
            <div className="grid gap-5 lg:grid-cols-2">
              <ImagePicker
                name="image"
                label="الصورة الرئيسية"
                value={form.image || null}
                folder="content"
                aspect="aspect-[4/3]"
                hint="مقاس مقترح ١٢٠٠×٩٠٠ بكسل."
                onChange={(value) => set("image", value ?? "")}
              />
              <div className="flex flex-col gap-4">
                <IconPicker
                  label="الأيقونة"
                  value={form.icon || null}
                  onChange={(value) => set("icon", value ?? "")}
                  hint="تظهر في البطاقات وفي رأس صفحة التفاصيل."
                />
                <Field
                  label="النص البديل للصورة"
                  htmlFor="imageAlt"
                  optional
                  hint="يُقرأ آليًا؛ مهم لإمكانية الوصول وتحسين محركات البحث."
                >
                  <Input
                    id="imageAlt"
                    value={form.imageAlt}
                    disabled={disabled}
                    placeholder="مثال: جلسة في غرفة مضاءة"
                    onChange={(event) => set("imageAlt", event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="تحسين محركات البحث" description="يُستخدم في الوصف والعنوان إذا لم يُكتب.">
            <div className="flex flex-col gap-4">
              <Field label="عنوان SEO" htmlFor="seoTitle" optional>
                <Input
                  id="seoTitle"
                  value={form.seoTitle}
                  disabled={disabled}
                  onChange={(event) => set("seoTitle", event.target.value)}
                />
              </Field>
              <Field label="وصف SEO" htmlFor="seoDescription" optional hint={`${form.seoDescription.length} / 160 حرفًا`}>
                <Textarea
                  id="seoDescription"
                  rows={3}
                  value={form.seoDescription}
                  disabled={disabled}
                  onChange={(event) => set("seoDescription", event.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="النشر والترتيب" description="أزرار المظهر في صفحة القسم.">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الترتيب" htmlFor="order" hint="الأصغر يظهر أولًا.">
                  <Input
                    id="order"
                    type="number"
                    min={0}
                    max={9999}
                    value={String(form.order)}
                    disabled={disabled}
                    onChange={(event) => set("order", Number(event.target.value) || 0)}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox
                  id="isActive"
                  label="التفعيل"
                  description="يظهر في الموقع العام."
                  checked={form.isActive}
                  disabled={disabled}
                  onChange={(event) => set("isActive", event.target.checked)}
                />
                <Checkbox
                  id="isFeatured"
                  label="التمييز على الرئيسية"
                  description="يبرز في قسم الخدمات على الصفحة الرئيسية."
                  checked={form.isFeatured}
                  disabled={disabled}
                  onChange={(event) => set("isFeatured", event.target.checked)}
                />
              </div>
            </div>
          </Panel>
        </div>

        {/* ── Preview ────────────────────────────────────── */}
        {preview && (
          <div className="xl:sticky xl:top-6">
            <ContentPreview value={form} typeLabel={typeLabel} />
          </div>
        )}
      </div>

      {/* ── Sticky save bar ─────────────────────────────── */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white/95 px-4 py-3 shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink-900/95">
        <div className="flex items-center gap-2">
          {pending && (
            <Loader2 className="size-4 animate-spin text-brand-600" aria-hidden />
          )}
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {pending ? "جارٍ الحفظ…" : "التغييرات تُطبّق على الموقع فور الحفظ."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {id && (
            <ConfirmButton
              onConfirm={async () => {
                await run(() => deleteContentItem({ id, type }), {
                  successMessage: "تم الحذف.",
                  onSuccess: () => router.push(`/admin/content/${type}`),
                });
              }}
            >
              حذف العنصر
            </ConfirmButton>
          )}
          <Link
            href={`/admin/content/${type}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-sand-100 px-5 text-sm font-bold text-ink-700 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-400 dark:hover:bg-white/15"
          >
            <ArrowRight className="size-4" aria-hidden />
            رجوع للقائمة
          </Link>
          <Button
            type="submit"
            size="md"
            icon={Save}
            disabled={disabled}
            loading={pending}
          >
            {id ? "حفظ التعديلات" : "نشر العنصر"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Row controls for the list screen
// ═══════════════════════════════════════════════════════════════

/**
 * ▲▼ reorder + active/featured toggles + delete, kept in one client component so
 * the list page itself can stay a Server Component.
 */
export function ContentRowActions({
  id,
  type,
  title,
  index,
  total,
  isActive,
  isFeatured,
  canEdit,
}: {
  id: string;
  type: string;
  title: string;
  index: number;
  total: number;
  isActive: boolean;
  isFeatured: boolean;
  canEdit: boolean;
}) {
  const { run, pending } = useAction();
  const router = useRouter();

  const move = (direction: "up" | "down") =>
    run(() => reorderContentItems({ type, id, direction }), {
      successMessage: "تم تحديث الترتيب.",
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => move("up")}
          disabled={!canEdit || pending || index === 0}
          aria-label={`نقل «${title}» إلى الأعلى`}
          title="تحريك لأعلى"
          className="grid size-6 place-items-center rounded-md text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 dark:hover:bg-white/10"
        >
          <ChevronUp className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => move("down")}
          disabled={!canEdit || pending || index === total - 1}
          aria-label={`نقل «${title}» إلى الأسفل`}
          title="تحريك لأسفل"
          className="grid size-6 place-items-center rounded-md text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 dark:hover:bg-white/10"
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={() =>
          run(() => toggleContentItem({ id, field: "isFeatured", value: !isFeatured }))
        }
        disabled={!canEdit || pending}
        aria-pressed={isFeatured}
        title={isFeatured ? "إلغاء التمييز" : "تمييز على الرئيسية"}
        className={
          isFeatured
            ? "grid size-8 place-items-center rounded-lg bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200 dark:bg-gold-500/15 dark:text-gold-300 dark:ring-gold-500/20"
            : "grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-sand-100 disabled:opacity-40 dark:hover:bg-white/10"
        }
      >
        <Star className="size-4" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() =>
          run(() => toggleContentItem({ id, field: "isActive", value: !isActive }))
        }
        disabled={!canEdit || pending}
        aria-pressed={isActive}
        title={isActive ? "تعطيل" : "تفعيل"}
        className={
          isActive
            ? "grid size-8 place-items-center rounded-lg bg-success-50 text-success-700 ring-1 ring-inset ring-success-100 dark:bg-success-500/15 dark:text-success-700 dark:ring-success-500/20"
            : "grid size-8 place-items-center rounded-lg bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100 dark:bg-danger-500/15 dark:text-danger-700 dark:ring-danger-500/20"
        }
      >
        <Eye className="size-4" aria-hidden />
      </button>

      <Link
        href={`/admin/content/${type}/${id}`}
        title="تعديل"
        aria-label={`تعديل «${title}»`}
        className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-white/10"
      >
        <Pencil className="size-4" aria-hidden />
      </Link>

      <ConfirmButton
        size="sm"
        onConfirm={async () => {
          await run(() => deleteContentItem({ id, type }), {
            successMessage: "تم الحذف.",
            onSuccess: () => router.refresh(),
          });
        }}
      >
        حذف
      </ConfirmButton>
    </div>
  );
}

/** Small chip used by the list table for the thumbnail fallback. */
export function ItemIconChip({ icon, index }: { icon: string | null; index: number }) {
  return <IconChip icon={icon} tone={chipToneFor(index)} size="sm" />;
}
