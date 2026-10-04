import type { Metadata } from "next";
import { ArrowLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { ButtonLink } from "@/components/ui/primitives";
import { BlocksForm } from "./blocks-form";
import type { BlockRow } from "@/components/admin/content/list-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "كتل المحتوى" };

const TABS = ["trust", "process", "values", "why", "stats", "testimonials", "faqs"] as const;

function str(value: string | null, fallback = ""): string {
  return value ?? fallback;
}

export default async function ContentBlocksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab = TABS.includes(rawTab as (typeof TABS)[number])
    ? (rawTab as string)
    : TABS[0];

  const { user } = await getAuthContext();
  const canEdit = can(user?.role, "content.edit");

  const [
    trustItems,
    processSteps,
    valueItems,
    whyItems,
    statistics,
    testimonials,
    faqs,
  ] = await Promise.all([
    prisma.trustItem.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.processStep.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.valueItem.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.whyItem.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.statistic.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.testimonial.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.faq.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
  ]);

  const rows: Record<string, BlockRow[]> = {
    trust: trustItems.map((row) => ({
      id: row.id,
      values: {
        title: row.title,
        description: str(row.description),
        icon: str(row.icon, "BadgeCheck"),
        order: row.order,
        isActive: row.isActive,
      },
    })),
    process: processSteps.map((row) => ({
      id: row.id,
      values: {
        title: row.title,
        description: row.description,
        icon: str(row.icon, "Compass"),
        order: row.order,
        isActive: row.isActive,
      },
    })),
    values: valueItems.map((row) => ({
      id: row.id,
      values: {
        title: row.title,
        description: row.description,
        icon: str(row.icon, "Gem"),
        order: row.order,
        isActive: row.isActive,
      },
    })),
    why: whyItems.map((row) => ({
      id: row.id,
      values: {
        title: row.title,
        description: row.description,
        icon: str(row.icon, "Star"),
        order: row.order,
        isActive: row.isActive,
      },
    })),
    stats: statistics.map((row) => ({
      id: row.id,
      values: {
        label: row.label,
        value: row.value,
        prefix: str(row.prefix),
        suffix: str(row.suffix),
        icon: str(row.icon),
        isHighlight: row.isHighlight,
        order: row.order,
        isActive: row.isActive,
      },
    })),
    testimonials: testimonials.map((row) => ({
      id: row.id,
      values: {
        quote: row.quote,
        authorName: str(row.authorName),
        authorRole: str(row.authorRole),
        rating: row.rating,
        isAnonymous: row.isAnonymous,
        image: str(row.image),
        order: row.order,
        isActive: row.isActive,
      },
    })),
    faqs: faqs.map((row) => ({
      id: row.id,
      values: {
        question: row.question,
        answer: row.answer,
        category: str(row.category, "عام"),
        order: row.order,
        isActive: row.isActive,
      },
    })),
  };

  return (
    <>
      <AdminPageHeader
        breadcrumb={[{ href: "/admin/content", label: "المحتوى" }]}
        title="كتل المحتوى"
        description="الكتل القصيرة التي تملأ الصفحة الرئيسية وصفحة «من نحن»: شريط الثقة، المنهجية، القيم، الأسباب، الأرقام، الشهادات، والأسئلة الشائعة. افتح أي تبويب ورتّب أو عدّل محتواه."
        action={
          <>
            <ButtonLink href="/admin/content" size="sm" variant="outline" icon={ArrowLeft}>
              كل الأقسام
            </ButtonLink>
            <ButtonLink
              href="/admin/content/SERVICE/new"
              size="sm"
              variant="primary"
              icon={Plus}
            >
              محتوى جديد
            </ButtonLink>
          </>
        }
      />

      {!canEdit && (
        <p className="mb-5 rounded-2xl border border-warn-100 bg-warn-50 px-4 py-3 text-sm font-bold text-warn-700 dark:border-warn-500/20 dark:bg-warn-500/10 dark:text-warn-500">
          لا تملك صلاحية تعديل المحتوى — العرض للقراءة فقط.
        </p>
      )}

      <BlocksForm initialTab={initialTab} rows={rows} canEdit={canEdit} />
    </>
  );
}
