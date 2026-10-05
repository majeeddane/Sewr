"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  MessagesSquare,
  FolderTree,
  Newspaper,
  Image as ImageIcon,
  Images as ImagesIcon,
  Settings,
  ShieldCheck,
  ScrollText,
  ChevronLeft,
  X,
  LogOut,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { useThemeToggle } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import type { allowedSections } from "@/lib/rbac";

type Sections = ReturnType<typeof allowedSections>;

interface NavEntry {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  exact?: boolean;
  badgeKey?: "messages" | "clients";
}

const PRIMARY: NavEntry[] = [
  { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard, show: true, exact: true },
  { href: "/admin/clients", label: "المستفيدون", icon: Users, show: true, badgeKey: "clients" },
  { href: "/admin/appointments", label: "المواعيد", icon: CalendarDays, show: true },
  { href: "/admin/messages", label: "الرسائل", icon: MessagesSquare, show: true, badgeKey: "messages" },
];

const CONTENT: NavEntry[] = [
  { href: "/admin/content", label: "المحتوى", icon: FolderTree, show: true },
  { href: "/admin/posts", label: "المدونة", icon: Newspaper, show: true },
  { href: "/admin/media", label: "مكتبة الوسائط", icon: ImageIcon, show: true },
    { href: "/admin/images", label: "الصور", icon: ImagesIcon, show: true },
];

const SYSTEM: NavEntry[] = [
  { href: "/admin/settings", label: "إعدادات الموقع", icon: Settings, show: true },
  { href: "/admin/users", label: "المستخدمون", icon: ShieldCheck, show: true },
  { href: "/admin/activity", label: "سجل النشاط", icon: ScrollText, show: true },
];

function NavGroup({
  title,
  entries,
  badges,
  onNavigate,
}: {
  title: string;
  entries: NavEntry[];
  badges: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = entries.filter((e) => e.show);
  if (!visible.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1.5 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {visible.map((entry) => {
          const active = entry.exact
            ? pathname === entry.href
            : pathname.startsWith(entry.href);
          const count = entry.badgeKey ? badges[entry.badgeKey] ?? 0 : 0;
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-bold transition-all",
                  active
                    ? "bg-brand-800 text-white shadow-soft"
                    : "text-ink-600 hover:bg-sand-100 hover:text-brand-800 dark:text-ink-300 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <entry.icon
                  className={cn(
                    "size-4.5 shrink-0 transition-colors",
                    active
                      ? "text-gold-300"
                      : "text-ink-400 group-hover:text-brand-600 dark:text-ink-500",
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{entry.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[0.6875rem] font-extrabold",
                      active
                        ? "bg-gold-400 text-brand-950"
                        : "bg-danger-100 text-danger-700",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminSidebar({
  sections,
  userName,
  userRole,
  badges,
  onLogout,
}: {
  sections: Sections;
  userName: string;
  userRole: Role;
  badges: Record<string, number>;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { dark, toggle, hydrate } = useThemeToggle();

  // Apply the stored preference once on the client (never during render, which
  // would mismatch the server HTML).
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const panel = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo size={34} />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="إغلاق القائمة"
          className="grid size-9 place-items-center rounded-xl text-ink-500 hover:bg-sand-100 lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-6" aria-label="أقسام لوحة التحكم">
        <NavGroup
          title="الرئيسية"
          entries={PRIMARY.map((e) => ({
            ...e,
            show:
              e.href === "/admin"
                ? true
                : e.href === "/admin/clients"
                  ? sections.clients
                  : e.href === "/admin/appointments"
                    ? sections.appointments
                    : sections.messages,
          }))}
          badges={badges}
          onNavigate={() => setMobileOpen(false)}
        />
        <NavGroup
          title="المحتوى"
          entries={CONTENT.map((e) => ({
            ...e,
            show:
              e.href === "/admin/content"
                ? sections.content
                : e.href === "/admin/posts"
                  ? sections.posts
                  : sections.media,
          }))}
          badges={badges}
          onNavigate={() => setMobileOpen(false)}
        />
        <NavGroup
          title="النظام"
          entries={SYSTEM.map((e) => ({
            ...e,
            show:
              e.href === "/admin/settings"
                ? sections.settings
                : e.href === "/admin/users"
                  ? sections.users
                  : sections.activity,
          }))}
          badges={badges}
          onNavigate={() => setMobileOpen(false)}
        />
      </nav>

      {/* Account card */}
      <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="truncate text-sm font-extrabold text-brand-900 dark:text-white">
          {userName}
        </p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          {ROLE_LABELS[userRole] ?? userRole}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-bold text-ink-600 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-100 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10 dark:hover:bg-white/15"
          >
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {dark ? "فاتح" : "داكن"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-bold text-danger-600 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-danger-50 dark:bg-white/10 dark:ring-white/10 dark:hover:bg-danger-500/20"
          >
            <LogOut className="size-3.5" />
            خروج
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar (start edge = right, because the UI is RTL) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[17rem] border-e border-sand-200 bg-white lg:block dark:border-white/10 dark:bg-[#1b1524]">
        {panel}
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="فتح قائمة لوحة التحكم"
        className="fixed start-4 top-4 z-30 grid size-11 place-items-center rounded-xl border border-sand-200 bg-white text-brand-800 shadow-soft lg:hidden dark:border-white/10 dark:bg-[#1b1524] dark:text-white"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-brand-950/50 backdrop-blur-sm lg:hidden"
          />
          <aside className="fixed inset-y-0 start-0 z-50 w-[17rem] bg-white shadow-lift lg:hidden dark:bg-[#1b1524]">
            {panel}
          </aside>
        </>
      )}
    </>
  );
}

/** Desktop page header — title, description and primary action. */
export function AdminPageHeader({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="مسار التنقل">
            <ol className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronLeft className="size-3 opacity-60" aria-hidden />}
                  {index === breadcrumb.length - 1 ? (
                    <span className="text-ink-600 dark:text-ink-300">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-brand-700">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl text-brand-900 sm:text-[1.75rem] dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-500 dark:text-ink-400">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
