"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const TONE_META: Record<
  ToastTone,
  { icon: typeof Info; ring: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: "ring-success-100",
    iconClass: "bg-success-50 text-success-600",
  },
  error: {
    icon: XCircle,
    ring: "ring-danger-100",
    iconClass: "bg-danger-50 text-danger-600",
  },
  warning: {
    icon: TriangleAlert,
    ring: "ring-warn-100",
    iconClass: "bg-warn-50 text-warn-600",
  },
  info: { icon: Info, ring: "ring-info-100", iconClass: "bg-info-50 text-info-600" },
};

type Listener = (toast: Omit<ToastItem, "id">) => void;
const listeners = new Set<Listener>();
let counter = 0;

/**
 * Minimal toast bus.
 *
 * Server Actions cannot return a toast, so pages call `toast.success(...)` from
 * a client component after `await action()`. The queue is a module-level array
 * of subscribers, which keeps the API importable from any client module.
 */
export function toast(tone: ToastTone, title: string, description?: string) {
  const item = { tone, title, description };
  if (listeners.size === 0) {
    console.info("[toast]", tone, title, description ?? "");
    return;
  }
  listeners.forEach((listener) => listener(item));
}

toast.success = (title: string, description?: string) =>
  toast("success", title, description);
toast.error = (title: string, description?: string) =>
  toast("error", title, description);
toast.info = (title: string, description?: string) =>
  toast("info", title, description);
toast.warning = (title: string, description?: string) =>
  toast("warning", title, description);

export function Toaster({ position = "bottom-start" }: { position?: "bottom-start" | "top-start" }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: Listener = (item) => {
      const id = ++counter;
      setItems((current) => [...current.slice(-3), { ...item, id }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((t) => t.id !== id));
      }, 5200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        "pointer-events-none fixed z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5",
        position === "bottom-start"
          ? "bottom-5 start-5"
          : "top-5 start-5",
      )}
    >
      {items.map((item) => {
        const meta = TONE_META[item.tone];
        const Icon = meta.icon;
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-lift ring-1",
              meta.ring,
              "animate-[fade-up_0.35s_cubic-bezier(0.22,1,0.36,1)_both]",
            )}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", meta.iconClass)}>
              <Icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-900">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-600">
                  {item.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setItems((c) => c.filter((t) => t.id !== item.id))}
              aria-label="إغلاق التنبيه"
              className="shrink-0 rounded-lg p-1 text-ink-400 transition-colors hover:bg-sand-100 hover:text-ink-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
