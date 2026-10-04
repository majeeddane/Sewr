"use client";

import * as React from "react";
import { Check, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Colour control: a native swatch (`<input type="color">`) beside the hex code.
 *
 * Fully controlled — the parent owns the value so the "restore defaults"
 * button can repaint both swatches without remounting the field.
 */
export function ColorField({
  name,
  label,
  value,
  onChange,
  defaultValue,
  hint,
  disabled,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown next to the field so the owner knows what "reset" means. */
  defaultValue: string;
  hint?: string;
  disabled?: boolean;
}) {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  const safe = isHex ? value : defaultValue;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-bold text-ink-800 dark:text-ink-200">
        {label}
      </span>

      <div className="flex items-center gap-3">
        <label
          className={cn(
            "relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-inset ring-sand-300 dark:ring-white/15",
            disabled && "cursor-not-allowed opacity-60",
          )}
          style={{ backgroundColor: safe }}
        >
          <span className="sr-only">اختر {label}</span>
          <input
            type="color"
            value={safe}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <Input
          name={name}
          dir="ltr"
          value={value}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          invalid={!isHex}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono uppercase"
        />
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-500">
        {hint ?? "صيغة سداسية مثل "}
        {!hint && (
          <span dir="ltr" className="font-semibold text-ink-700 dark:text-ink-200">
            {defaultValue}
          </span>
        )}
        {hint && (
          <span className="mt-0.5 block text-xs text-ink-400">
            الافتراضي:{" "}
            <span dir="ltr" className="font-semibold">
              {defaultValue}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

/** Small "matches the default" marker used next to a colour field. */
export function ColorDefaultMark({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-success-700 dark:text-success-500">
      <Check className="size-3.5" aria-hidden />
      <span dir="ltr">{value}</span>
    </span>
  );
}

export function ColorWarning() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-warn-100 bg-warn-50 p-3 text-[0.8125rem] leading-relaxed text-warn-700 dark:border-warn-500/25 dark:bg-warn-500/10 dark:text-warn-500">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      الألوان الافتراضية جزء من هوية المركز البصرية: بنفسجي <span dir="ltr">#4B2A7B</span>{" "}
      وذهبي <span dir="ltr">#D9A441</span>. تغييرهما يؤثر على الموقع العام بالكامل، فاخترهما
      بعناية.
    </p>
  );
}