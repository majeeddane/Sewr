import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { Panel } from "@/components/admin/widgets";
import { ClientForm, type ClientOption } from "../client-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مستفيد جديد" };

export default async function NewClientPage() {
  const { user } = await getAuthContext();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "clients.view")) redirect("/admin");
  if (!can(user.role, "clients.edit")) redirect("/admin/clients");

  const [programs, staff, serviceCatalog, pastCities] = await Promise.all([
    prisma.contentItem.findMany({
      where: { type: "PROGRAM", isActive: true },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
    // Suggestions for the free-text service field.
    prisma.contentItem.findMany({
      where: { type: "SERVICE", isActive: true },
      select: { title: true },
      orderBy: { order: "asc" },
    }),
    prisma.client.findMany({
      where: { city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
      take: 60,
    }),
  ]);

  const usedServices = await prisma.client.findMany({
    where: { serviceInterest: { not: null } },
    distinct: ["serviceInterest"],
    select: { serviceInterest: true },
    take: 40,
  });

  const serviceSuggestions = Array.from(
    new Set(
      [
        ...serviceCatalog.map((item) => item.title),
        ...usedServices.map((row) => row.serviceInterest ?? ""),
      ].filter(Boolean),
    ),
  ).slice(0, 40);

  const citySuggestions = pastCities
    .map((row) => row.city ?? "")
    .filter(Boolean)
    .slice(0, 40);

  const programOptions: ClientOption[] = programs.map((item) => ({
    id: item.id,
    label: item.title,
  }));

  const assigneeOptions: ClientOption[] = staff.map((member) => ({
    id: member.id,
    label: member.jobTitle ? `${member.name} — ${member.jobTitle}` : member.name,
  }));

  return (
    <>
      <AdminPageHeader
        title="تسجيل مستفيد جديد"
        description="يُسجَّل الطلب مع رقم مرجعي تلقائي. الجوال والبريد والملاحظات تُخزَّن مشفّرة."
        breadcrumb={[
          { href: "/admin/clients", label: "المستفيدون" },
          { href: "/admin/clients/new", label: "مستفيد جديد" },
        ]}
      />

      <Panel
        title="بيانات الطلب"
        description="الحقول المعلّمة بنجمة إلزامية. الحقول الاختيارية يمكن إكمالها لاحقًا."
      >
        <ClientForm
          mode="create"
          programs={programOptions}
          assignees={assigneeOptions}
          serviceSuggestions={serviceSuggestions}
          citySuggestions={citySuggestions}
        />
      </Panel>
    </>
  );
}
