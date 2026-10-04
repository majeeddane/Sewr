"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { AlertTriangle } from "lucide-react";

/**
 * Calls a Server Action that returns
 * `{ ok: boolean; message?: string; errors?: Record<string,string> }`
 * and surfaces the result as a toast, so every admin form reports consistently.
 */
export interface ActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async <T extends ActionResult>(
      action: () => Promise<T>,
      opts: { successMessage?: string; onSuccess?: () => void } = {},
    ): Promise<T> => {
      setPending(true);
      try {
        const result = await action();
        if (result.ok) {
          toast.success(opts.successMessage ?? result.message ?? "تم الحفظ بنجاح.");
          opts.onSuccess?.();
          router.refresh();
        } else {
          toast.error(result.message ?? "تعذّر إتمام العملية.");
          if (result.errors) {
            for (const [field, message] of Object.entries(result.errors)) {
              toast.error(message, `الحقل: ${field}`);
            }
          }
        }
        return result;
      } catch (error) {
        toast.error(
          "حدث خطأ غير متوقع.",
          error instanceof Error ? error.message : undefined,
        );
        return { ok: false } as T;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending };
}

/**
 * Two-step destructive action. Keeps the admin from deleting anything with a
 * single stray click.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "تأكيد الحذف",
  message = "لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟",
  variant = "danger",
  size = "sm",
  className,
}: {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  confirmLabel?: string;
  message?: string;
  variant?: "danger" | "primary" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const click = async () => {
    if (!armed) {
      setArmed(true);
      // Disarm automatically so the state never sticks around.
      timer.current = window.setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setBusy(true);
    try {
      await onConfirm();
      setArmed(false);
    } finally {
      setBusy(false);
    }
  };

  const base =
    variant === "danger"
      ? "bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-100 hover:bg-danger-100"
      : variant === "outline"
        ? "bg-white text-ink-700 ring-1 ring-inset ring-sand-300 hover:bg-sand-50"
        : "bg-brand-800 text-white hover:bg-brand-900";
  const armedStyle =
    variant === "danger"
      ? "bg-danger-600 text-white ring-danger-600 hover:bg-danger-700"
      : "bg-brand-900 text-white";

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      aria-live="polite"
      title={armed ? message : undefined}
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-bold transition-all disabled:opacity-60",
        size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm",
        armed ? armedStyle : base,
        className ?? "",
      ].join(" ")}
    >
      {armed && <AlertTriangle className="size-3.5" aria-hidden />}
      {busy ? "…" : armed ? confirmLabel : children}
    </button>
  );
}
