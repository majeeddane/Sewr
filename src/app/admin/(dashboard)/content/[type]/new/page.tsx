import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/shell";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { CONTENT_TYPE_LABELS, isContentType } from "@/lib/enums";
import { ContentForm } from "../content-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إضافة محتوى جديد" };

const PLURALS = {
  SERVICE: "خدمة جديدة",
  PROGRAM: "برنامج جديد",
  PROTOCOL: "بروتوكول جديد",
} as const;

export default async function NewContentItemPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: rawType } = await params;
  if (!isContentType(rawType)) notFound();
  const type = rawType;

  const { user } = await getAuthContext();
  const canEdit = can(user?.role, "content.edit");

  return (
    <>
      <AdminPageHeader
        breadcrumb={[
          { href: "/admin/content", label: "المحتوى" },
          { href: `/admin/content/${type}`, label: CONTENT_TYPE_LABELS[type] },
        ]}
        title={PLURALS[type]}
        description="املأ المحتوى من الأعلى للأسفل، وراجعه بالمعاينة الحية قبل الحفظ."
      />
      {/* No `initial` prop: the editor builds its own empty draft client-side. */}
      <ContentForm type={type} typeLabel={CONTENT_TYPE_LABELS[type]} canEdit={canEdit} />
    </>
  );
}
