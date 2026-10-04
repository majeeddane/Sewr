"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Eraser, FileDown } from "lucide-react";

import { ConfirmButton } from "@/components/admin/use-action";
import { ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Shared client islands for the activity screen.
 *
 * They live here (rather than next to the route) because `actions.ts` files in
 * this project are per-section, and these two components only need a Server
 * Action handed to them as a prop.
 */

export interface SimpleActionResult {
  ok: boolean;
  message?: string;
}

/**
 * "تنظيف السجلات القديمة" behind a two-step confirm.
 *
 * The retention window is decided on the server; this button only asks for a
 * deliberate second click before firing it.
 */
export function PruneActivityButton({
  onPrune,
  disabled,
  label = "تنظيف السجلات القديمة",
}: {
  onPrune: () => Promise<SimpleActionResult>;
  disabled?: boolean;
  label?: string;
}) {
  const [done, setDone] = React.useState(false);

  if (disabled) {
    return (
      <span
        title="يتطلب صلاحية عرض سجل النشاط"
        className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full bg-sand-100 px-4 text-xs font-bold text-ink-300 opacity-70 dark:bg-white/10 dark:text-ink-500"
      >
        <Eraser className="size-3.5" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <ConfirmButton
      variant="danger"
      size="sm"
      confirmLabel="تأكيد التنظيف"
      message="سيُحذف سجل النشاط الأقدم من سنة كاملة نهائيًا."
      onConfirm={async () => {
        const result = await onPrune();
        if (result.ok) setDone(true);
      }}
    >
      <Eraser className="size-3.5" aria-hidden />
      {done ? "تم التنظيف" : label}
    </ConfirmButton>
  );
}

/**
 * Delivers a server-built CSV to the browser.
 *
 * The BOM makes Excel open the Arabic text correctly, and the anchor click
 * happens once on mount so the file lands in the downloads folder without the
 * owner leaving the filtered view.
 */
export function CsvDownload({
  csv,
  filename,
  total,
}: {
  csv: string;
  filename: string;
  total: number;
}) {
  React.useEffect(() => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [csv, filename]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-success-100 bg-success-50 px-6 py-14 text-center dark:border-success-500/25 dark:bg-success-500/10">
      <span className="grid size-14 place-items-center rounded-2xl bg-white text-success-600 shadow-soft dark:bg-white/10 dark:text-success-500">
        <FileDown className="size-7" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-extrabold text-brand-900 dark:text-white">
          تم تنزيل ملف السجل
        </h2>
        <p className="mt-1 text-[0.875rem] text-ink-600 dark:text-ink-300">
          <strong>{total}</strong> سجل مطابق للمرشّحات الحالية في الملف{" "}
          <span dir="ltr" className="font-semibold">
            {filename}
          </span>
          . سُجّلت عملية التصدير في سجل النشاط.
        </p>
      </div>
      <ButtonLink href="/admin/activity" variant="primary" icon={ArrowLeft}>
        العودة إلى السجل
      </ButtonLink>
    </div>
  );
}

/** Filter toolbar shared by the list view. */
export function ActivityExportLink({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900",
        className,
      )}
    >
      <FileDown className="size-3.5" aria-hidden />
      تصدير CSV
    </Link>
  );
}