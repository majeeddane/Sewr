"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { ICON_CHOICES, getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Renders a whitelisted icon by name.
 *
 * Uses `createElement` on purpose: the React Compiler lint rules reject a
 * component looked up inside a component body (`const Icon = getIcon(name)`),
 * even though the lookup returns a stable module-scope reference.
 */
export function IconGlyph({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  return React.createElement(getIcon(name ?? null), {
    className,
    "aria-hidden": true,
  });
}

/**
 * Searchable icon grid.
 *
 * The list comes from `ICON_CHOICES` (the whitelist the public renderer can
 * actually draw), so the dashboard can never store an icon name the site would
 * not be able to resolve.
 */
export function IconPicker({
  value,
  onChange,
  label,
  hint,
  allowClear = true,
  disabled = false,
  className,
}: {
  value: string | null | undefined;
  onChange: (icon: string | null) => void;
  label?: string;
  hint?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ICON_CHOICES;
    return ICON_CHOICES.filter(
      (choice) =>
        choice.name.toLowerCase().includes(needle) ||
        choice.label.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-sm font-bold text-ink-800">{label}</span>}

      {/* Hidden input so the value also travels with any surrounding form. */}
      <input type="hidden" name="icon" value={value ?? ""} />

      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-white/10 dark:text-gold-300 dark:ring-white/10"
        >
          <IconGlyph name={value} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-500 dark:text-ink-400" dir="ltr">
          {value ?? "بدون أيقونة"}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 disabled:opacity-50 dark:bg-white/10 dark:text-ink-400 dark:ring-white/10 dark:hover:bg-white/15"
        >
          <Search className="size-3.5" aria-hidden />
          {open ? "إغلاق" : "اختيار أيقونة"}
        </button>
        {allowClear && value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="inline-flex size-9 items-center justify-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100 transition-colors hover:bg-danger-100 disabled:opacity-50"
            aria-label="إزالة الأيقونة"
            title="إزالة الأيقونة"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-0 grid w-10 place-items-center text-ink-400"
            >
              <Search className="size-4" />
            </span>
            <input
              type="search"
              value={query}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الأيقونة…"
              aria-label="ابحث عن أيقونة"
              className="h-10 w-full rounded-xl border border-sand-300 bg-white ps-10 pe-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-400"
            />
          </div>

          {results.length === 0 ? (
            <p className="py-6 text-center text-xs font-bold text-ink-500">
              لا توجد نتائج مطابقة.
            </p>
          ) : (
            <ul className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">
              {results.map((choice) => {
                const selected = choice.name === value;
                return (
                  <li key={choice.name}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(choice.name);
                        setOpen(false);
                      }}
                      aria-pressed={selected}
                      title={choice.name}
                      className={cn(
                        "flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all",
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100"
                          : "border-sand-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-ink-400 dark:hover:bg-white/10",
                      )}
                    >
                      <span className="relative">
                        <IconGlyph name={choice.name} className="size-5" />
                        {selected && (
                          <span className="absolute -end-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-brand-700 text-white">
                            <Check className="size-2.5" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[0.625rem] font-bold leading-tight">
                        {choice.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {hint && <p className="text-[0.8125rem] text-ink-500">{hint}</p>}
    </div>
  );
}
