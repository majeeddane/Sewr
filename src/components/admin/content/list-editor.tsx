"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { ImagePicker } from "@/components/admin/image-picker";
import { ConfirmButton, useAction } from "@/components/admin/use-action";
import { Badge, Button } from "@/components/ui/primitives";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { IconPicker } from "@/app/admin/(dashboard)/content/[type]/icon-picker";
import { deleteBlockItem, reorderBlockItems, saveBlockItem } from "@/app/admin/(dashboard)/content/actions";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
//  Descriptor — one per Prisma block model
// ═══════════════════════════════════════════════════════════════

export type BlockFieldType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "icon"
  | "image"
  | "rating";

export type BlockValue = string | number | boolean | null;

export interface BlockFieldSpec {
  name: string;
  label: string;
  type: BlockFieldType;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  /** Tailwind grid span, e.g. "sm:col-span-2". */
  className?: string;
}

export interface BlockDescriptor {
  /** Prisma model name — also the audit-log entity. */
  model: string;
  label: string;
  description: string;
  /** The single column used as the collapsed-row summary. */
  summaryField: string;
  fields: BlockFieldSpec[];
  /** Values for a brand-new (unsaved) row. */
  blank: Record<string, BlockValue>;
  /** Suggest the next free `order` value. */
  nextOrder: (rows: Array<{ values: Record<string, BlockValue> }>) => number;
}

export interface BlockRow {
  id: string;
  values: Record<string, BlockValue>;
}

const TEMP_PREFIX = "new:";

// ═══════════════════════════════════════════════════════════════
//  Field renderer
// ═══════════════════════════════════════════════════════════════

function BlockField({
  spec,
  value,
  onChange,
  disabled,
  id,
}: {
  spec: BlockFieldSpec;
  value: BlockValue;
  onChange: (value: BlockValue) => void;
  disabled: boolean;
  id: string;
}) {
  const fieldId = `${id}-${spec.name}`;

  switch (spec.type) {
    case "checkbox":
      return (
        <Checkbox
          id={fieldId}
          label={spec.label}
          description={spec.hint}
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="sm:col-span-2"
        />
      );

    case "rating":
      return (
        <Field label={spec.label} hint={spec.hint}>
          <div className="flex items-center gap-1.5" role="group" aria-label={spec.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                aria-pressed={Number(value) >= n}
                aria-label={`${n} من 5`}
                className={cn(
                  "grid size-10 place-items-center rounded-xl transition-colors disabled:opacity-50",
                  Number(value) >= n
                    ? "bg-gold-50 text-gold-600 ring-1 ring-inset ring-gold-200 dark:bg-gold-500/15 dark:text-gold-300"
                    : "bg-sand-100 text-ink-400 ring-1 ring-inset ring-sand-200 dark:bg-white/10 dark:ring-white/10",
                )}
              >
                <Star className="size-4.5" aria-hidden />
              </button>
            ))}
          </div>
        </Field>
      );

    case "icon":
      return (
        <IconPicker
          label={spec.label}
          hint={spec.hint}
          value={typeof value === "string" ? value : null}
          disabled={disabled}
          onChange={(next) => onChange(next)}
        />
      );

    case "image":
      return (
        <ImagePicker
          name={fieldId}
          label={spec.label}
          hint={spec.hint}
          value={typeof value === "string" && value ? value : null}
          folder="content"
          aspect="aspect-[16/9]"
          onChange={(next) => onChange(next)}
        />
      );

    case "textarea":
      return (
        <Field
          label={spec.label}
          htmlFor={fieldId}
          hint={spec.hint}
          required={spec.required}
          optional={spec.optional}
          className={spec.className}
        >
          <Textarea
            id={fieldId}
            rows={3}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            placeholder={spec.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="text-[0.875rem]"
          />
        </Field>
      );

    case "number":
      return (
        <Field
          label={spec.label}
          htmlFor={fieldId}
          hint={spec.hint}
          required={spec.required}
          className={spec.className}
        >
          <Input
            id={fieldId}
            type="number"
            min={0}
            max={9999}
            disabled={disabled}
            value={String(typeof value === "number" ? value : 0)}
            onChange={(event) => onChange(Number(event.target.value) || 0)}
          />
        </Field>
      );

    default:
      return (
        <Field
          label={spec.label}
          htmlFor={fieldId}
          hint={spec.hint}
          required={spec.required}
          optional={spec.optional}
          className={spec.className}
        >
          <Input
            id={fieldId}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            placeholder={spec.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      );
  }
}

// ═══════════════════════════════════════════════════════════════
//  The editor
// ═══════════════════════════════════════════════════════════════

/**
 * Generic reorderable list editor for the small ordered blocks
 * (trust bar, process, values, why, statistics, testimonials, FAQs).
 *
 * It owns the local draft state and talks to the shared Server Actions, so
 * every block screen is just a descriptor plus rows. The caller must pass a
 * `key` derived from the row ids: that remounts the editor whenever the server
 * hands back a different set of rows (after a create or a delete) so the local
 * drafts never drift from the database.
 */
export function ListEditor({
  descriptor,
  rows,
  canEdit,
}: {
  descriptor: BlockDescriptor;
  rows: BlockRow[];
  canEdit: boolean;
}) {
  const { run, pending } = useAction();
  const [drafts, setDrafts] = React.useState<BlockRow[]>(() =>
    rows.map((row) => ({ id: row.id, values: { ...row.values } })),
  );
  const [open, setOpen] = React.useState<string | null>(null);
  const [tempCounter, setTempCounter] = React.useState(0);

  const update = (id: string, name: string, value: BlockValue) => {
    setDrafts((current) =>
      current.map((row) =>
        row.id === id ? { ...row, values: { ...row.values, [name]: value } } : row,
      ),
    );
  };

  const addRow = () => {
    const id = `${TEMP_PREFIX}${Date.now().toString(36)}${tempCounter}`;
    setTempCounter((n) => n + 1);
    setDrafts((current) => [
      ...current,
      {
        id,
        values: {
          ...descriptor.blank,
          order: descriptor.nextOrder(drafts),
          isActive: true,
        },
      },
    ]);
    setOpen(id);
  };

  const removeRow = (id: string) => {
    setDrafts((current) => current.filter((row) => row.id !== id));
    setOpen((current) => (current === id ? null : current));
  };

  /** Sends the whole visible order so `order` stays a clean 1..n sequence. */
  const persistOrder = (next: BlockRow[]) => {
    const ids = next.filter((row) => !row.id.startsWith(TEMP_PREFIX)).map((row) => row.id);
    if (ids.length < 2) return Promise.resolve();
    return run(() => reorderBlockItems({ model: descriptor.model, ids }), {
      successMessage: "تم تحديث الترتيب.",
    });
  };

  const move = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setDrafts(next);
    void persistOrder(next);
  };

  const save = async (row: BlockRow) => {
    const result = await run(() =>
      saveBlockItem({
        model: descriptor.model,
        id: row.id.startsWith(TEMP_PREFIX) ? null : row.id,
        data: row.values,
      }),
    );
    if (result.ok) setOpen(null);
  };

  const disabled = !canEdit || pending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {descriptor.description}
        </p>
        <Button
          size="sm"
          variant="primary"
          icon={Plus}
          disabled={disabled}
          onClick={addRow}
          className="shrink-0"
        >
          إضافة صف
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 px-6 py-12 text-center dark:border-white/15">
          <p className="font-bold text-ink-600 dark:text-ink-400">
            لا توجد عناصر في «{descriptor.label}» بعد.
          </p>
          <p className="mt-1 text-xs text-ink-400">
            اضغط «إضافة صف» لإنشاء العنصر الأول.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((row, index) => {
            const isNew = row.id.startsWith(TEMP_PREFIX);
            const summary = row.values[descriptor.summaryField];
            const isActive = row.values.isActive !== false;
            const expanded = open === row.id;

            return (
              <li
                key={row.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white transition-colors dark:bg-white/5",
                  expanded
                    ? "border-brand-300 dark:border-brand-500/40"
                    : "border-sand-200 dark:border-white/10",
                )}
              >
                {/* Collapsed header */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-800 text-xs font-extrabold text-white"
                  >
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : row.id)}
                    aria-expanded={expanded}
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className="block truncate text-sm font-bold text-brand-900 dark:text-white">
                      {typeof summary === "string" && summary.trim().length
                        ? summary
                        : "عنصر بلا عنوان"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-ink-400">
                      {isNew ? <Badge tone="gold">جديد — لم يُحفظ</Badge> : null}
                      {isActive ? "مفعّل" : "معطّل"}
                      <span aria-hidden>·</span>
                      الترتيب {String(row.values.order ?? 0)}
                    </span>
                  </button>

                  {!isActive && (
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-400 dark:bg-white/10">
                      <EyeOff className="size-3.5" aria-hidden />
                    </span>
                  )}
                  {row.values.isHighlight === true && (
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300">
                      <Star className="size-3.5" aria-hidden />
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, "up")}
                      disabled={disabled || index === 0}
                      aria-label="تحريك لأعلى"
                      title="تحريك لأعلى"
                      className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 dark:hover:bg-white/10"
                    >
                      <ChevronUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, "down")}
                      disabled={disabled || index === drafts.length - 1}
                      aria-label="تحريك لأسفل"
                      title="تحريك لأسفل"
                      className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 dark:hover:bg-white/10"
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : row.id)}
                      aria-label={expanded ? "طيّ العنصر" : "فتح العنصر"}
                      title={expanded ? "طيّ" : "تعديل"}
                      className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-white/10"
                    >
                      <Eye className="size-4" aria-hidden />
                    </button>
                    {!isNew && (
                      <ConfirmButton
                        size="sm"
                        onConfirm={async () => {
                          await run(() =>
                            deleteBlockItem({ model: descriptor.model, id: row.id }),
                          );
                        }}
                      >
                        حذف
                      </ConfirmButton>
                    )}
                    {isNew && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-3.5 py-1.5 text-xs font-bold text-danger-700 ring-1 ring-inset ring-danger-100 transition-colors hover:bg-danger-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded fields */}
                {expanded && (
                  <div className="border-t border-sand-200 bg-sand-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {descriptor.fields.map((spec) => (
                        <BlockField
                          key={spec.name}
                          id={row.id.replace(/[^a-zA-Z0-9]/g, "")}
                          spec={spec}
                          value={row.values[spec.name] ?? null}
                          disabled={disabled}
                          onChange={(value) => update(row.id, spec.name, value)}
                        />
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4 dark:border-white/10">
                      <p className="text-[0.6875rem] text-ink-400">
                        الترتيب يُحفظ مع بقية القائمة دفعة واحدة.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => setOpen(null)}
                          disabled={pending}
                        >
                          إغلاق
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Save}
                          loading={pending}
                          disabled={disabled}
                          onClick={() => save(row)}
                        >
                          {isNew ? "إضافة" : "حفظ"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <p className="flex items-center gap-2 text-xs font-bold text-ink-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          جارٍ الحفظ…
        </p>
      )}
    </div>
  );
}
