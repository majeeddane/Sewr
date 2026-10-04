import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Blocks,
  CircleHelp,
  Compass,
  FolderTree,
  Gem,
  HeartHandshake,
  Layers,
  MessageSquareHeart,
  Newspaper,
  Plus,
  Quote,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { StatCard } from "@/components/admin/widgets";
import { ButtonLink } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المحتوى" };

interface HubCard {
  href: string;
  title: string;
  description: string;
  count: number;
  active?: number;
  icon: typeof FolderTree;
  tone: "brand" | "gold" | "success" | "warn" | "info";
}

/** One place where every editable block of the site is declared. */
const SECTIONS = [
  {
    key: "service",
    title: "الخدمات",
    description: "جلسات وخدمات الاستشارة الفردية والعائلية مع التفاصيل والخطوات.",
    href: "/admin/content/SERVICE",
    icon: HeartHandshake,
    tone: "brand" as const,
  },
  {
    key: "program",
    title: "البرامج",
    description: "برامج التأهيل والتدريب طويلة المدى، مع المخرجات المتوقعة.",
    href: "/admin/content/PROGRAM",
    icon: Layers,
    tone: "info" as const,
  },
  {
    key: "protocol",
    title: "البروتوكولات",
    description: "بروتوكولات المتابعة الدقيقة بعد التعافي خطوة بخطوة.",
    href: "/admin/content/PROTOCOL",
    icon: BadgeCheck,
    tone: "success" as const,
  },
  {
    key: "trust",
    title: "شريط الثقة",
    description: "الشارات الستة أسفل القسم الرئيسي في الصفحة الرئيسية.",
    href: "/admin/content/blocks?tab=trust",
    icon: Sparkles,
    tone: "gold" as const,
  },
  {
    key: "process",
    title: "منهجية التعافي",
    description: "خطوات المنهجية المعروضة كأرقام متسلسلة.",
    href: "/admin/content/blocks?tab=process",
    icon: Compass,
    tone: "brand" as const,
  },
  {
    key: "values",
    title: "القيم",
    description: "القيم التي يتبنى المركز بها تعامله مع المستفيدين.",
    href: "/admin/content/blocks?tab=values",
    icon: Gem,
    tone: "gold" as const,
  },
  {
    key: "why",
    title: "لماذا تختارنا",
    description: "أسباب اختيار المركز، تظهر في صفحة من نحن.",
    href: "/admin/content/blocks?tab=why",
    icon: Star,
    tone: "info" as const,
  },
  {
    key: "stats",
    title: "الإحصائيات",
    description: "الأرقام المعروضة في الشريط البنفسجي. ⚠ القيم الافتراضية للتوضيح فقط.",
    href: "/admin/content/blocks?tab=stats",
    icon: TrendingUp,
    tone: "warn" as const,
  },
  {
    key: "testimonials",
    title: "آراء المستفيدين",
    description: "شهادات المستفيدين مع الاسم اختياريًا والتقييم.",
    href: "/admin/content/blocks?tab=testimonials",
    icon: Quote,
    tone: "success" as const,
  },
  {
    key: "faqs",
    title: "الأسئلة الشائعة",
    description: "أسئلة الموقع العامة مصنّفة حسب الموضوع.",
    href: "/admin/content/blocks?tab=faqs",
    icon: CircleHelp,
    tone: "brand" as const,
  },
  {
    key: "pages",
    title: "الصفحات",
    description: "الصفحات الطويلة (سياسة الخصوصية، الشروط…) تُحرَّر من إعدادات الموقع.",
    href: "/admin/settings",
    icon: Newspaper,
    tone: "info" as const,
  },
] as const;

export default async function ContentHubPage() {
  const [
    services,
    servicesActive,
    programs,
    programsActive,
    protocols,
    protocolsActive,
    trustItems,
    processSteps,
    valueItems,
    whyItems,
    statistics,
    testimonials,
    faqs,
    pages,
    publishedPosts,
  ] = await Promise.all([
    prisma.contentItem.count({ where: { type: "SERVICE" } }),
    prisma.contentItem.count({ where: { type: "SERVICE", isActive: true } }),
    prisma.contentItem.count({ where: { type: "PROGRAM" } }),
    prisma.contentItem.count({ where: { type: "PROGRAM", isActive: true } }),
    prisma.contentItem.count({ where: { type: "PROTOCOL" } }),
    prisma.contentItem.count({ where: { type: "PROTOCOL", isActive: true } }),
    prisma.trustItem.count(),
    prisma.processStep.count(),
    prisma.valueItem.count(),
    prisma.whyItem.count(),
    prisma.statistic.count(),
    prisma.testimonial.count(),
    prisma.faq.count(),
    prisma.page.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
  ]);

  const counts: Record<string, number> = {
    service: services,
    program: programs,
    protocol: protocols,
    trust: trustItems,
    process: processSteps,
    values: valueItems,
    why: whyItems,
    stats: statistics,
    testimonials,
    faqs,
    pages,
  };

  const activeCounts: Record<string, number> = {
    service: servicesActive,
    program: programsActive,
    protocol: protocolsActive,
  };

  const cards: HubCard[] = SECTIONS.map((section) => ({
    href: section.href,
    title: section.title,
    description: section.description,
    count: counts[section.key] ?? 0,
    active: activeCounts[section.key],
    icon: section.icon,
    tone: section.tone,
  }));

  const totalItems = cards.reduce((sum, card) => sum + card.count, 0);

  return (
    <>
      <AdminPageHeader
        title="إدارة المحتوى"
        description="كل نصوص وصور الموقع القابلة للتعديل تجتمع هنا. اختر قسمًا لتعديله — لا حاجة لكتابة أي كود."
        action={
          <ButtonLink href="/admin/content/SERVICE/new" size="sm" variant="primary" icon={Plus}>
            محتوى جديد
          </ButtonLink>
        }
      />

      {/* Prominent reminder about the placeholder statistics. */}
      <div
        role="note"
        className="mb-6 flex flex-wrap items-start gap-3 rounded-2xl border border-warn-100 bg-warn-50 px-5 py-4 dark:border-warn-500/25 dark:bg-warn-500/10"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-100 text-warn-700 dark:bg-warn-500/20 dark:text-warn-500"
        >
          <TriangleAlert className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-warn-700 dark:text-warn-100">
            تنبيه مهم قبل الإطلاق
          </p>
          <p className="mt-1 text-[0.9375rem] leading-[1.9] text-warn-700 dark:text-warn-500">
            الأرقام في الإحصائيات القيم الافتراضية — استبدلها بأرقامك الحقيقية قبل الإطلاق.
          </p>
        </div>
        <ButtonLink
          href="/admin/content/blocks?tab=stats"
          size="sm"
          variant="gold"
          icon={ArrowLeft}
          className="shrink-0"
        >
          راجع الإحصائيات
        </ButtonLink>
      </div>

      {/* Top-line numbers */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="الخدمات"
          value={services}
          hint={`${servicesActive} مفعّلة · ${services - servicesActive} معطّلة`}
          icon={HeartHandshake}
          href="/admin/content/SERVICE"
        />
        <StatCard
          label="البرامج والبروتوكولات"
          value={programs + protocols}
          hint={`${programsActive + protocolsActive} مفعّلة من أصل ${programs + protocols}`}
          icon={Layers}
          tone="info"
          href="/admin/content/PROGRAM"
        />
        <StatCard
          label="كتل الصفحة الرئيسية"
          value={trustItems + processSteps + valueItems + whyItems + statistics}
          hint="الثقة · المنهجية · القيم · لماذا · الأرقام"
          icon={Blocks}
          tone="gold"
          href="/admin/content/blocks"
        />
        <StatCard
          label="آراء وأسئلة شائعة"
          value={testimonials + faqs}
          hint={`${faqs} سؤال شائع · ${publishedPosts} مقال منشور`}
          icon={MessageSquareHeart}
          tone="success"
          href="/admin/content/blocks?tab=faqs"
        />
      </div>

      {/* Section grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href + card.title}
              href={card.href}
              className="group flex items-start gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-500/40"
            >
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-105",
                  index % 3 === 0 &&
                    "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200",
                  index % 3 === 1 &&
                    "bg-gold-50 text-gold-700 ring-gold-200 dark:bg-gold-500/15 dark:text-gold-200",
                  index % 3 === 2 &&
                    "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/15 dark:text-success-700",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-base font-extrabold text-brand-900 dark:text-white">
                    {card.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                      card.count === 0
                        ? "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500"
                        : "bg-sand-100 text-ink-600 dark:bg-white/10 dark:text-ink-400",
                    )}
                  >
                    {card.count}
                  </span>
                </span>
                <span className="text-[0.8125rem] leading-relaxed text-ink-500 dark:text-ink-400">
                  {card.description}
                </span>
                {typeof card.active === "number" && (
                  <span className="text-[0.6875rem] font-bold text-ink-400">
                    {card.active} مفعّلة · {card.count - card.active} معطّلة
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-400">
        إجمالي العناصر القابلة للتعديل في الموقع: <strong>{totalItems}</strong>. الترتيب في كل
        قسم يُحفظ فورًا ويظهر بنفس الترتيب في الموقع العام.
      </p>
    </>
  );
}
