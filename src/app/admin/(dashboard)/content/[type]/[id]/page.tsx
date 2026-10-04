import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { CONTENT_TYPE_LABELS, isContentType } from "@/lib/enums";
import { parseJson, formatDateTime } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/primitives";
import { ContentForm, type ContentFormValue } from "../content-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تعديل محتوى" };

type Step = { title: string; description: string };
type Faq = { question: string; answer: string };

/** Row → form state: every JSON column is parsed once, on the server. */
function toFormValue(item: {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  icon: string | null;
  image: string | null;
  imageAlt: string | null;
  audience: string | null;
  stepsJson: string | null;
  benefitsJson: string | null;
  outcomesJson: string | null;
  notesJson: string | null;
  faqsJson: string | null;
  durationLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
}): ContentFormValue {
  const strings = (value: string | null): string[] =>
    parseJson<string[]>(value, [])
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry);

  return {
    title: item.title,
    slug: item.slug,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription ?? "",
    icon: item.icon ?? "",
    image: item.image ?? "",
    imageAlt: item.imageAlt ?? "",
    audience: item.audience ?? "",
    steps: parseJson<Step[]>(item.stepsJson, []).map((step) => ({
      title: step?.title ?? "",
      description: step?.description ?? "",
    })),
    benefits: strings(item.benefitsJson),
    outcomes: strings(item.outcomesJson),
    notes: strings(item.notesJson),
    faqs: parseJson<Faq[]>(item.faqsJson, []).map((faq) => ({
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
    })),
    durationLabel: item.durationLabel ?? "",
    seoTitle: item.seoTitle ?? "",
    seoDescription: item.seoDescription ?? "",
    order: item.order,
    isActive: item.isActive,
    isFeatured: item.isFeatured,
  };
}

export default async function EditContentItemPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: rawType, id } = await params;
  if (!isContentType(rawType)) notFound();
  const type = rawType;

  // Scoping the lookup by `type` stops a hand-edited URL from opening the
  // editor for an item that lives in a different section.
  const item = await prisma.contentItem.findFirst({
    where: { id, type },
  });
  if (!item) notFound();

  const { user } = await getAuthContext();
  const canEdit = can(user?.role, "content.edit");

  return (
    <>
      <AdminPageHeader
        breadcrumb={[
          { href: "/admin/content", label: "المحتوى" },
          { href: `/admin/content/${type}`, label: CONTENT_TYPE_LABELS[type] },
        ]}
        title={item.title}
        description="عدّل المحتوى، ثم احفظ لتظهر التغييرات في الموقع فورًا."
        action={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={item.isActive ? "success" : "danger"}>
              {item.isActive ? "مفعّل" : "معطّل"}
            </Badge>
            {item.isFeatured && <Badge tone="gold">مميّز</Badge>}
            <Badge tone="outline">آخر تعديل: {formatDateTime(item.updatedAt)}</Badge>
          </span>
        }
      />

      <ContentForm
        type={type}
        typeLabel={CONTENT_TYPE_LABELS[type]}
        id={item.id}
        initial={toFormValue(item)}
        canEdit={canEdit}
      />
    </>
  );
}
