import * as React from "react";
import { cn } from "@/lib/utils";

const CONTROL_BASE =
  "w-full rounded-xl border border-sand-300 bg-white px-4 text-[0.9375rem] text-ink-900 shadow-sm transition-all duration-200 placeholder:text-ink-400 hover:border-sand-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 disabled:cursor-not-allowed disabled:bg-sand-100 disabled:text-ink-400";

const CONTROL_INVALID =
  "border-danger-500 focus:border-danger-500 focus:ring-danger-500/15";

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Renders a small "(اختياري)" label. */
  optional?: boolean;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  optional,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1.5 text-sm font-bold text-ink-800"
        >
          {label}
          {required && (
            <span aria-hidden className="text-danger-600">
              *
            </span>
          )}
          {optional && (
            <span className="text-xs font-medium text-ink-400">(اختياري)</span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-danger-600"
        >
          <span aria-hidden>⚠</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, invalid, iconStart, iconEnd, type = "text", ...props },
    ref,
  ) {
    const control = (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          "h-12",
          invalid && CONTROL_INVALID,
          iconStart && "ps-11",
          iconEnd && "pe-11",
          className,
        )}
        {...props}
      />
    );

    if (!iconStart && !iconEnd) return control;

    return (
      <div className="relative">
        {iconStart && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-ink-400"
          >
            {iconStart}
          </span>
        )}
        {control}
        {iconEnd && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-0 grid w-11 place-items-center text-ink-400"
          >
            {iconEnd}
          </span>
        )}
      </div>
    );
  },
);

// ── Textarea ──────────────────────────────────────────────────

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 5, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "resize-y py-3 leading-[1.9]",
        invalid && CONTROL_INVALID,
        className,
      )}
      {...props}
    />
  );
});

// ── Select ────────────────────────────────────────────────────

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          "h-12 cursor-pointer appearance-none pe-10",
          invalid && CONTROL_INVALID,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-0 grid w-10 place-items-center text-ink-400"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </div>
  );
});

// ── Checkbox & radio ──────────────────────────────────────────

export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-sand-50/70 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-2 border-sand-400 text-brand-700 accent-brand-700 focus:ring-2 focus:ring-brand-500/30"
        {...props}
      />
      <span className="flex flex-col gap-1 text-sm leading-relaxed">
        <span className="font-semibold text-ink-800">{label}</span>
        {description && (
          <span className="text-[0.8125rem] text-ink-500">{description}</span>
        )}
      </span>
    </label>
  );
}

export function RadioCard({
  label,
  description,
  icon,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-xl border-2 border-sand-200 bg-white p-4 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/30 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:shadow-soft",
        className,
      )}
    >
      <input
        id={id}
        type="radio"
        className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-700"
        {...props}
      />
      {icon && <span className="shrink-0 text-brand-700">{icon}</span>}
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="font-bold text-ink-800">{label}</span>
        {description && (
          <span className="text-[0.8125rem] leading-relaxed text-ink-500">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

// ── Honeypot ──────────────────────────────────────────────────

/**
 * Spam trap. Positioned off-screen but still reachable by naive bots.
 * `aria-hidden` + `tabIndex={-1}` keeps it away from screen-reader and
 * keyboard users.
 */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
      <label htmlFor="website-field">Website</label>
      <input
        id="website-field"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Submit button with pending state ──────────────────────────

export function SubmitButton({
  pending,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        "inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-brand-800 px-8 py-4 text-base font-bold text-white shadow-[0_14px_32px_-16px_rgba(75,42,123,0.85)] transition-all duration-300 hover:bg-brand-900 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {pending && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
