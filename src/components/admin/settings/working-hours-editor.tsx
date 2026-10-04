"use client";

import * as React from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { HOURS_PRESETS, WORK_DAYS } from "./constants";

/**
 * Repeater for `workingHoursJson`.
 *
 * Rows are written as paired `hoursDay` / `hoursValue` fields; the Server
 * Action zips them back into `[{ day, hours }]` and drops empty rows, so the
 * column always holds valid JSON.
 */
export interface WorkingHourRow {
  day: string;
  hours: string;
}

export function WorkingHoursEditor({
  initial,
  disabled,
}: {
  initial: WorkingHourRow[];
  disabled?: boolean;
}) {
  const [rows, setRows] = React.useState<WorkingHourRow[]>(
    initial.length > 0 ? initial : [{ day: "", hours: "" }],
  );

  const update = (index: number, patch: Partial<WorkingHourRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const remove = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
  };

  const add = () => {
    setRows((current) => [
      ...current,
      { day: WORK_DAYS.find((d) => !current.some((r) => r.day === d)) ?? "", hours: "" },
    ]);
  };

  const applyPreset = (days: readonly string[], hours: string) => {
    const next: WorkingHourRow[] = days.map((day) => ({ day, hours }));
    const untouched = rows.filter((row) => !days.includes(row.day));
    setRows([...next, ...untouched]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3 dark:border-gold-500/25 dark:bg-gold-500/10">
        <span className="flex items-center gap-1.5 text-xs font-bold text-gold-700 dark:text-gold-200">
          <Clock className="size-3.5" aria-hidden />
          إعداد سريع:
        </span>
        {HOURS_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => applyPreset(preset.days, preset.hours)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-ink-500">
        حقل «الساعات» نص حر، اكتبه كما يظهر للزائر:{" "}
        <span className="font-semibold text-ink-700 dark:text-ink-200">
          9:00 صباحًا – 9:00 مساءً
        </span>{" "}
        أو <span className="font-semibold text-ink-700 dark:text-ink-200">مغلق</span> أو{" "}
        <span className="font-semibold text-ink-700 dark:text-ink-200">بموعد سابق</span>.
      </p>

      {/* Rows */}
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={index}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-sand-200 bg-sand-50 p-3 dark:border-white/10 dark:bg-white/5"
          >
            <Field label="اليوم" htmlFor={`hours-day-${index}`} className="min-w-40 flex-1">
              <Select
                id={`hours-day-${index}`}
                name="hoursDay"
                value={row.day}
                disabled={disabled}
                onChange={(event) => update(index, { day: event.target.value })}
              >
                <option value="">— اختر اليوم —</option>
                {WORK_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="الساعات"
              htmlFor={`hours-value-${index}`}
              className="min-w-56 flex-[2]"
            >
              <Input
                id={`hours-value-${index}`}
                name="hoursValue"
                value={row.hours}
                disabled={disabled}
                placeholder="9:00 صباحًا – 9:00 مساءً"
                onChange={(event) => update(index, { hours: event.target.value })}
              />
            </Field>

            <button
              type="button"
              onClick={() => remove(index)}
              disabled={disabled}
              aria-label="حذف يوم"
              className="mb-1 grid size-10 shrink-0 place-items-center rounded-full text-danger-600 ring-1 ring-inset ring-danger-100 transition-colors hover:bg-danger-50 disabled:opacity-50 dark:ring-danger-500/30 dark:hover:bg-danger-500/15"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <Button type="button" variant="soft" size="sm" icon={Plus} disabled={disabled} onClick={add}>
        أضف يومًا
      </Button>
    </div>
  );
}