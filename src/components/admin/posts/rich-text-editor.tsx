"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table2,
  Type,
  Undo2,
  Redo2,
  FileText,
  Rows3,
  Columns3,
  Check,
  X,
} from "lucide-react";
import { cn, readingMinutes, stripHtml, formatNumber } from "@/lib/utils";

// ── Toolbar ───────────────────────────────────────────────────

const BTN_BASE =
  "grid size-9 shrink-0 place-items-center rounded-lg text-ink-600 transition-colors hover:bg-sand-100 hover:text-brand-800 disabled:pointer-events-none disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white";

const BTN_ON = "bg-brand-800 text-white hover:bg-brand-900 hover:text-white dark:bg-brand-600 dark:text-white dark:hover:bg-brand-500";

const HEADING_OPTIONS = [
  { value: "paragraph", label: "فقرة" },
  { value: "h2", label: "عنوان ٢" },
  { value: "h3", label: "عنوان ٣" },
  { value: "h4", label: "عنوان ٤" },
] as const;

type HeadingValue = (typeof HEADING_OPTIONS)[number]["value"];

/** Validates a URL before it is written into the document. */
function normalizeUrl(raw: string): { url: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "اكتب الرابط أولًا." };
  if (value.startsWith("/")) return { url: value };
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/i.test(url.protocol)) {
      return { error: "الروابط المسموح بها هي http و https فقط." };
    }
    return { url: url.toString() };
  } catch {
    return { error: "الرابط غير صالح." };
  }
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active ?? false}
      aria-label={label}
      title={label}
      className={cn(BTN_BASE, active && BTN_ON)}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-sand-300 dark:bg-white/15" />;
}

/** Inline panel used by the link / image / table buttons. */
function ToolPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-sand-200 bg-sand-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-brand-900 dark:text-white">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid size-7 place-items-center rounded-lg text-ink-400 hover:bg-sand-200 hover:text-ink-700 dark:hover:bg-white/10"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}

const PANEL_INPUT =
  "h-10 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10";

const PANEL_BTN =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900 disabled:opacity-50";

function EditorToolbar({ editor }: { editor: Editor }) {
  const [panel, setPanel] = React.useState<null | "link" | "image" | "table">(null);
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState(3);
  const [cols, setCols] = React.useState(3);
  const [withHeader, setWithHeader] = React.useState(true);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      hardBreak: e.isActive("hardBreak"),
      horizontalRule: e.isActive("horizontalRule"),
      inTable: e.isActive("table"),
      link: e.isActive("link"),
      heading: (() => {
        for (const level of ["h2", "h3", "h4"] as const) {
          if (e.isActive("heading", { level })) return level;
        }
        return "paragraph";
      })(),
      alignRight: e.isActive({ textAlign: "right" }),
      alignCenter: e.isActive({ textAlign: "center" }),
      alignLeft: e.isActive({ textAlign: "left" }),
      canUndo: e.can().chain().focus().undo().run(),
      canRedo: e.can().chain().focus().redo().run(),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });

  const close = () => {
    setPanel(null);
    setError(null);
  };

  const openLink = () => {
    setUrl(state.href);
    setAlt("");
    setError(null);
    setPanel("link");
  };

  const applyLink = () => {
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      close();
      return;
    }
    const result = normalizeUrl(url);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: result.url }).run();
    close();
  };

  const applyImage = () => {
    const result = normalizeUrl(url);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    editor.chain().focus().setImage({ src: result.url, alt: alt.trim() }).run();
    close();
  };

  return (
    <div
      role="toolbar"
      aria-label="أدوات تنسيق المحتوى"
      className="flex flex-col border-b border-sand-200 bg-sand-50 dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex flex-wrap items-center gap-1 p-2">
        {/* Heading dropdown */}
        <div className="relative">
          <Type
            className="pointer-events-none absolute inset-y-0 start-2 my-auto size-4 text-ink-400"
            aria-hidden
          />
          <select
            value={state.heading}
            aria-label="نمط الفقرة أو العنوان"
            title="نمط الفقرة أو العنوان"
            onChange={(event) => {
              const value = event.target.value as HeadingValue;
              if (value === "paragraph") editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 })
                  .run();
            }}
            className="h-9 rounded-lg border border-sand-300 bg-white py-0 ps-8 pe-7 text-xs font-bold text-ink-700 focus:border-brand-500 focus:outline-none dark:border-white/15 dark:bg-white/10 dark:text-ink-200"
          >
            {HEADING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <ToolbarDivider />

        <ToolbarButton
          label="عريض"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="مائل"
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="قائمة نقطية"
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="قائمة مرقّمة"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="اقتباس"
          active={state.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" aria-hidden />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="سطر فاصل"
          active={state.hardBreak}
          onClick={() => editor.chain().focus().setHardBreak().run()}
        >
          <FileText className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="خط فاصل أفقي"
          active={state.horizontalRule}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="size-4" aria-hidden />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="إدراج جدول"
          active={panel === "table"}
          onClick={() => {
            setError(null);
            setPanel(panel === "table" ? null : "table");
          }}
        >
          <Table2 className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="إدراج صورة"
          active={panel === "image"}
          onClick={() => {
            setUrl("");
            setAlt("");
            setError(null);
            setPanel(panel === "image" ? null : "image");
          }}
        >
          <ImageIcon className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="إضافة رابط" active={state.link} onClick={openLink}>
          <Link2 className="size-4" aria-hidden />
        </ToolbarButton>
        {state.link && (
          <ToolbarButton label="إزالة الرابط" onClick={() => editor.chain().focus().unsetLink().run()}>
            <Link2Off className="size-4" aria-hidden />
          </ToolbarButton>
        )}

        <ToolbarDivider />

        <ToolbarButton
          label="محاذاة لليمين"
          active={state.alignRight}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="توسيط"
          active={state.alignCenter}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="محاذاة لليسار"
          active={state.alignLeft}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-4" aria-hidden />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="تراجع"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="إعادة"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" aria-hidden />
        </ToolbarButton>
      </div>

      {panel === "link" && (
        <ToolPanel title="رابط" onClose={close}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              dir="ltr"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
              placeholder="https://example.com"
              aria-label="عنوان الرابط"
              aria-invalid={Boolean(error)}
              className={cn(PANEL_INPUT, error && "border-danger-500")}
            />
            <button type="button" onClick={applyLink} className={cn(PANEL_BTN, "shrink-0")}>
              <Check className="size-3.5" aria-hidden />
              اعتماد
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              close();
            }}
            className="self-start text-xs font-bold text-danger-600 hover:underline"
          >
            إزالة الرابط من النص المحدد
          </button>
        </ToolPanel>
      )}

      {panel === "image" && (
        <ToolPanel title="إدراج صورة" onClose={close}>
          <input
            type="url"
            dir="ltr"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            placeholder="https://example.com/photo.jpg أو /uploads/2026/…"
            aria-label="رابط الصورة"
            aria-invalid={Boolean(error)}
            className={cn(PANEL_INPUT, error && "border-danger-500")}
          />
          <input
            type="text"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="وصف الصورة لقارئات الشاشة (اختياري)"
            aria-label="النص البديل للصورة"
            className={PANEL_INPUT}
          />
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger-600">
              {error}
            </p>
          )}
          <button type="button" onClick={applyImage} className={cn(PANEL_BTN, "self-start")}>
            <ImageIcon className="size-3.5" aria-hidden />
            إدراج الصورة
          </button>
          <p className="text-[0.6875rem] text-ink-400">
            انسخ الرابط من «مكتبة الوسائط» ثم الصقه هنا.
          </p>
        </ToolPanel>
      )}

      {panel === "table" && (
        <ToolPanel title="إدراج جدول" onClose={close}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-ink-700 dark:text-ink-200">
              <span className="flex items-center gap-1">
                <Rows3 className="size-3.5" aria-hidden />
                الصفوف
              </span>
              <select
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
                className={cn(PANEL_INPUT, "w-24")}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-ink-700 dark:text-ink-200">
              <span className="flex items-center gap-1">
                <Columns3 className="size-3.5" aria-hidden />
                الأعمدة
              </span>
              <select
                value={cols}
                onChange={(event) => setCols(Number(event.target.value))}
                className={cn(PANEL_INPUT, "w-24")}
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-10 cursor-pointer items-center gap-2 text-xs font-bold text-ink-700 dark:text-ink-200">
              <input
                type="checkbox"
                checked={withHeader}
                onChange={(event) => setWithHeader(event.target.checked)}
                className="size-4 rounded accent-brand-700"
              />
              صف رأس
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().insertTable({ rows, cols, withHeaderRow: withHeader }).run();
                close();
              }}
              className={PANEL_BTN}
            >
              <Table2 className="size-3.5" aria-hidden />
              إدراج الجدول
            </button>
            {state.inTable && (
              <>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="inline-flex h-10 items-center rounded-xl bg-sand-100 px-3 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
                >
                  + صف
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="inline-flex h-10 items-center rounded-xl bg-sand-100 px-3 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10"
                >
                  + عمود
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="inline-flex h-10 items-center rounded-xl bg-danger-50 px-3 text-xs font-bold text-danger-700 ring-1 ring-inset ring-danger-100 hover:bg-danger-100"
                >
                  حذف الجدول
                </button>
              </>
            )}
          </div>
        </ToolPanel>
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────

export interface RichTextEditorProps {
  /** Initial HTML (already sanitised on the server). */
  value: string;
  /** Fires on every document change with the current HTML. */
  onChange: (html: string) => void;
  /** Hidden input name so the HTML travels with a plain <form> too. */
  name?: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  name = "content",
  ariaLabel = "محتوى المقال",
  invalid,
  className,
}: RichTextEditorProps) {
  // `immediatelyRender: false` is required so the ProseMirror DOM is not
  // built during SSR (it would never match the client markup).
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: value,
    editorProps: {
      attributes: {
        dir: "rtl",
        "aria-label": ariaLabel,
        class:
          "prose-ar focus:outline-none min-h-[28rem] px-5 py-4 text-[1.0625rem] leading-[2.05]",
      },
    },
    extensions: [
      StarterKit.configure({
        // Link is configured explicitly below (openOnClick: false).
        link: false,
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      TiptapImage.configure({ allowBase64: false }),
      TableKit.configure({
        table: { resizable: false },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["right", "center", "left"],
      }),
      Placeholder.configure({ placeholder: "اكتب محتوى المقال…" }),
    ],
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      // `editor` is still null until TipTap mounts on the client.
      if (!e) return { chars: 0, words: 0, minutes: 1 };
      const html = e.getHTML();
      const text = stripHtml(html);
      return {
        chars: text.length,
        words: text.split(/\s+/).filter(Boolean).length,
        minutes: readingMinutes(html),
      };
    },
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-white/5",
        invalid ? "border-danger-500" : "border-sand-300 dark:border-white/15",
        className,
      )}
    >
      {editor ? (
        <>
          <EditorToolbar editor={editor} />
          <EditorContent
            editor={editor}
            dir="rtl"
            className="bg-white dark:bg-transparent [&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-right [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-ink-400 [&_.is-empty]:before:content-[attr(data-placeholder)]"
          />
          <input type="hidden" name={name} value={value} readOnly />
        </>
      ) : (
        <div
          aria-busy="true"
          className="grid min-h-[28rem] place-items-center px-5 py-10 text-sm text-ink-400"
        >
          جارٍ تحميل محرّر المحتوى…
        </div>
      )}

      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 bg-sand-50 px-4 py-2.5 text-[0.6875rem] font-bold text-ink-500 dark:border-white/10 dark:bg-white/5 dark:text-ink-400">
          <span>
            {formatNumber(stats.words)} كلمة · {formatNumber(stats.chars)} حرف
          </span>
          <span>وقت قراءة تقريبي: {formatNumber(stats.minutes)} دقيقة</span>
        </div>
      )}
    </div>
  );
}

export default RichTextEditor;