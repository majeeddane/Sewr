import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  MessagesSquare,
  CalendarCheck,
  Newspaper,
  ArrowLeft,
  Activity,
  Plus,
  UserPlus,
  CalendarPlus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/shell";
import { StatCard, Panel, BarChart } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/primitives";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  ACTIVITY_ACTION_LABELS,
  ENTITY_LABELS,
  type AppointmentStatus,
} from "@/lib/enums";
import { formatDate, formatTime, timeAgo, toDateInputValue } from "@/lib/utils";
import { publishDuePosts } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نظرة عامة" };

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AdminDashboardPage() {
  // Publish anything whose scheduled time has arrived.
  await publishDuePosts();

  const now = new Date();
  const today = startOfDay(now);
  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);

  const [
    newClients,
    clientsThisMonth,
    unreadMessages,
    upcomingCount,
    publishedPosts,
    scheduledPosts,
    draftPosts,
    staffCount,
    upcoming,
    recentActivity,
    clientsInRange,
    messagesInRange,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "NEW" } }),
    prisma.client.count({
      where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
    }),
    prisma.contactMessage.count({ where: { isRead: false, isArchived: false } }),
    prisma.appointment.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        preferredDate: { gte: today, lte: in7days },
      },
    }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "SCHEDULED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.appointment.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        preferredDate: { gte: today },
      },
      include: { client: { select: { id: true, fullName: true, code: true } } },
      orderBy: [{ preferredDate: "asc" }, { preferredTime: "asc" }],
      take: 6,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // Last 14 days of activity for the chart.
    prisma.client.findMany({
      where: { createdAt: { gte: new Date(today.getTime() - 13 * 86_400_000) } },
      select: { createdAt: true },
    }),
    prisma.contactMessage.findMany({
      where: { createdAt: { gte: new Date(today.getTime() - 13 * 86_400_000) } },
      select: { createdAt: true },
    }),
  ]);

  // Build a 14-day series: [new clients, new messages]
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = startOfDay(new Date(today.getTime() - (13 - i) * 86_400_000));
    const next = new Date(date.getTime() + 86_400_000);
    return {
      key: date.toISOString(),
      label: String(date.getDate()),
      clients: clientsInRange.filter(
        (c) => c.createdAt >= date && c.createdAt < next,
      ).length,
      messages: messagesInRange.filter(
        (m) => m.createdAt >= date && m.createdAt < next,
      ).length,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="نظرة عامة"
        description={`مرحبًا بك. هذا ملخّص ما يحدث في المركز حتى ${formatDate(now)}.`}
        action={
          <>
            <ButtonLink href="/admin/clients/new" variant="primary" size="sm" icon="UserPlus">
              طلب جديد
            </ButtonLink>
            <ButtonLink href="/admin/appointments" variant="gold" size="sm" icon="CalendarPlus">
              المواعيد
            </ButtonLink>
          </>
        }
      />

      {/* ── KPI cards ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="طلبات جديدة"
          value={newClients}
          hint={`${clientsThisMonth} طلبًا هذا الشهر`}
          icon={Users}
          href="/admin/clients?status=NEW"
        />
        <StatCard
          label="رسائل غير مقروءة"
          value={unreadMessages}
          hint="صندوق وارد الموقع"
          icon={MessagesSquare}
          tone="warn"
          href="/admin/messages?filter=unread"
        />
        <StatCard
          label="مواعيد الأسبوع"
          value={upcomingCount}
          hint="بانتظار التأكيد أو مؤكدة"
          icon={CalendarCheck}
          tone="success"
          href="/admin/appointments"
        />
        <StatCard
          label="مقالات منشورة"
          value={publishedPosts}
          hint={`${scheduledPosts} مجدول · ${draftPosts} مسودة`}
          icon={Newspaper}
          tone="gold"
          href="/admin/posts"
        />
      </div>

      {/* ── Chart + upcoming ──────────────────────────── */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel
          title="الطلبات والرسائل — آخر ١٤ يومًا"
          description="أزرق: طلبات مستفيدين · ذهبي: رسائل واردة"
          className="xl:col-span-2"
        >
          <BarChart
            label="الطلبات والرسائل خلال آخر ١٤ يومًا"
            data={days.map((d) => ({ label: d.label, values: [d.clients, d.messages] }))}
          />
          <div className="mt-4 flex flex-wrap gap-4 border-t border-sand-200 pt-4 text-xs text-ink-500 dark:border-white/10">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-brand-600" />
              طلبات مستفيدين
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-gold-400" />
              رسائل واردة
            </span>
          </div>
        </Panel>

        <Panel
          title="المواعيد القادمة"
          action={
            <Link
              href="/admin/appointments"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
            >
              عرض الكل
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          }
          padded={false}
        >
          {upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-500">
              لا توجد مواعيد قادمة.
            </p>
          ) : (
            <ul className="divide-y divide-sand-200 dark:divide-white/10">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-900 dark:text-white">
                        {appointment.client?.fullName ?? appointment.clientName ?? "بدون اسم"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {appointment.service}
                      </p>
                    </div>
                    <Badge
                      tone={
                        APPOINTMENT_STATUS_STYLES[
                          appointment.status as AppointmentStatus
                        ]?.includes("emerald")
                          ? "success"
                          : "warn"
                      }
                      className="shrink-0"
                    >
                      {
                        APPOINTMENT_STATUS_LABELS[
                          appointment.status as AppointmentStatus
                        ]
                      }
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300">
                    <CalendarCheck className="size-3.5 text-brand-600" aria-hidden />
                    <span dir="ltr">
                      {toDateInputValue(appointment.preferredDate)}
                    </span>
                    {appointment.preferredTime && (
                      <>
                        <span aria-hidden>·</span>
                        <span dir="ltr">{appointment.preferredTime}</span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Activity + quick actions ──────────────────── */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel
          title="آخر النشاطات"
          action={
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
            >
              السجل الكامل
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">لا يوجد نشاط بعد.</p>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-500 dark:bg-white/10 dark:text-ink-300"
                  >
                    <Activity className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] leading-snug text-ink-700 dark:text-ink-200">
                      {log.summary}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-400">
                      {[
                        log.userName ?? "النظام",
                        ENTITY_LABELS[log.entity] ?? log.entity,
                        ACTIVITY_ACTION_LABELS[log.action] ?? log.action,
                        timeAgo(log.createdAt),
                      ].join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="إجراءات سريعة" className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/admin/posts/new",
                icon: Plus,
                title: "اكتب مقالًا جديدًا",
                hint: "احفظ كمسودة أو انشره أو جدوِل publishing له.",
              },
              {
                href: "/admin/clients",
                icon: UserPlus,
                title: "سجّل طلب استشارة",
                hint: "طلب وصل هاتفيًا أو بالحضور شخصيًا.",
              },
              {
                href: "/admin/content/services",
                icon: Plus,
                title: "أضف خدمة أو برنامجًا",
                hint: "كل النصوص والصور قابلة للتعديل بدون كود.",
              },
              {
                href: "/admin/settings",
                icon: CalendarPlus,
                title: "حدّث بيانات التواصل",
                hint: "الهاتف، الواتساب، العنوان، وساعات العمل.",
              },
            ].map((action) => (
              <Link
                key={action.href + action.title}
                href={action.href}
                className="group flex items-start gap-3.5 rounded-xl border border-sand-200 bg-sand-50 p-4 transition-all hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-500/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-sand-200 transition-transform group-hover:scale-105 dark:bg-white/10 dark:text-gold-300 dark:ring-white/10">
                  <action.icon className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-brand-900 dark:text-white">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                    {action.hint}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-5 border-t border-sand-200 pt-4 text-xs leading-relaxed text-ink-400 dark:border-white/10">
            يعمل الفريق الحالي: <strong>{staffCount}</strong> حسابات مفعّلة. تترك
            الجلسة تلقائيًا بعد فترة عدم نشاط protectively لحماية بيانات المستفيدين.
          </p>
        </Panel>
      </div>

      <p className="mt-6 text-xs text-ink-400">
        آخر تحديث: {formatDate(now)} — {formatTime(now)}
      </p>
    </>
  );
}
