"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  APPOINTMENT_STATUS_DOT,
  appointmentStatus,
  appointmentStatusClasses,
} from "@/components/admin/appointments/appointment-list";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES } from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * Month grid for the appointments board.
 *
 * Deliberately dependency-free: the server builds the day buckets (so the date
 * maths stays next to the database) and this component only renders them plus
 * the navigation links. The layout is RTL and the week starts on Sunday, which
 * matches `Date.getDay()` (0 = Sunday) with no offset arithmetic needed.
 */

export interface CalendarChip {
  id: string;
  time: string;
  name: string;
  status: string;
}

export interface CalendarDay {
  /** `YYYY-MM-DD` */
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  items: CalendarChip[];
}

const WEEKDAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const MAX_CHIPS = 3;

export function AppointmentCalendar({
  days,
  monthLabel,
  prevMonth,
  nextMonth,
  query,
  selectedDate,
  todayKey,
}: {
  days: CalendarDay[];
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  /** Current query string as a plain object, so filters survive navigation. */
  query: Record<string, string>;
  selectedDate?: string | null;
  todayKey: string;
}) {
  const href = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(query);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const search = params.toString();
      return search ? `/admin/appointments?${search}` : "/admin/appointments";
    },
    [query],
  );

  const total = days.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
      {/* Month navigation */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-4 py-3.5 dark:border-white/10">
        <div className="flex items-center gap-2">
          <NavLink href={href({ month: prevMonth, date: null })} label="الشهر السابق">
            <ChevronRight className="size-4" aria-hidden />
          </NavLink>
          <NavLink href={href({ month: nextMonth, date: null })} label="الشهر التالي">
            <ChevronLeft className="size-4" aria-hidden />
          </NavLink>
        </div>

        <h2 className="flex items-center gap-2 text-base font-extrabold text-brand-900 dark:text-white">
          <CalendarDays className="size-4.5 text-brand-600 dark:text-gold-300" aria-hidden />
          {monthLabel}
        </h2>

        <Link
          href={href({ date: todayKey })}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15"
        >
          اليوم
        </Link>
      </header>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-sand-200 bg-sand-50 dark:border-white/10 dark:bg-white/5">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "px-1 py-2.5 text-center text-[0.6875rem] font-extrabold uppercase tracking-wide text-ink-500",
              // Weekend days are muted, matching a Saudi working week.
              index === 5 && "text-warn-600",
              index === 6 && "text-warn-600",
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const selected = Boolean(selectedDate) && day.date === selectedDate;
          const overflow = day.items.length - MAX_CHIPS;
          return (
            <Link
              key={day.date}
              href={href({ date: day.date })}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "flex min-h-[6.5rem] flex-col gap-1 border-e border-b border-sand-200 p-1.5 transition-colors [&:nth-child(7n)]:border-e-0 dark:border-white/10 sm:min-h-[7.5rem] sm:p-2",
                "hover:bg-brand-50/60 dark:hover:bg-white/5",
                day.inMonth
                  ? "bg-white dark:bg-transparent"
                  : "bg-sand-50/60 dark:bg-white/[0.02]",
                selected && "bg-brand-50 ring-2 ring-inset ring-brand-500 dark:bg-brand-500/10 dark:ring-brand-400/60",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-lg text-xs font-extrabold tabular-nums",
                  day.isToday
                    ? "bg-brand-800 text-white dark:bg-gold-400 dark:text-brand-950"
                    : day.inMonth
                      ? "text-ink-700 dark:text-ink-200"
                      : "text-ink-300 dark:text-ink-500",
                )}
              >
                {day.dayNumber}
              </span>

              {day.items.slice(0, MAX_CHIPS).map((item) => (
                <span
                  key={item.id}
                  title={`${item.time ? `${item.time} — ` : ""}${item.name} · ${APPOINTMENT_STATUS_LABELS[appointmentStatus(item.status)]}`}
                  className={cn(
                    "flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-[0.625rem] font-bold ring-1 ring-inset",
                    appointmentStatusClasses(item.status),
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      APPOINTMENT_STATUS_DOT[appointmentStatus(item.status)],
                    )}
                  />
                  <span dir="ltr" className="shrink-0 tabular-nums">
                    {item.time || "—"}
                  </span>
                  <span className="truncate">{item.name}</span>
                </span>
              ))}

              {overflow > 0 && (
                <span className="px-1 text-[0.625rem] font-bold text-ink-400">
                  +{overflow} أخرى
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Legend */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-sand-200 bg-sand-50 px-4 py-3 text-[0.6875rem] font-bold text-ink-500 dark:border-white/10 dark:bg-white/5">
        <span className="text-ink-400">
          {total} موعد في هذا الشهر — انقر على أي يوم لعرض مواعيده.
        </span>
        {APPOINTMENT_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full ring-1 ring-inset ring-sand-300",
                APPOINTMENT_STATUS_DOT[status],
              )}
            />
            {APPOINTMENT_STATUS_LABELS[status]}
          </span>
        ))}
      </footer>
    </section>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-lg bg-sand-100 text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15"
    >
      {children}
    </Link>
  );
}
