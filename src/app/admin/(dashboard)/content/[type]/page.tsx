import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Filter, Plus, Search, X } from "lucide-react";
import type { ContentItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_PATHS,
  CONTENT_TYPES,
  isContentType,
} from "@/lib/enums";
import { AdminPageHeader } from "@/components/admin/shell";
import { DataTable, Pagination, type Column } from "@/components/admin/widgets";
import { Badge, Button, ButtonLink } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { ContentRowActions, ItemIconChip } from "./content-form";
import { IconGlyph } from "./icon-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إدارة المحتوى" };

const PAGE_SIZE = 25;

type StatusFilter = "all" | "active" | "inactive";
type FeaturedFilter = "all" | "yes" | "no";

/** Plural Arabic section titles — the singular label reads badly in a header. */
const SECTION_TITLES: Record<(typeof CONTENT_TYPES)[number], string> = {
  SERVICE: "الخدمات",
  PROGRAM: "البرامج",
  PROTOCOL: "البروتوكولات",
};

export default async function ContentItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { type: rawType } = await params;
  if (!isContentType(rawType)) notFound();
  const type = rawType;

  const sp = await searchParams;
  const first = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

  const query = first(sp.q).trim();
  const statusRaw = first(sp.status);
  const featuredRaw = first(sp.featured);
  const pageRaw = Number(first(sp.page) || "1");

  const status: StatusFilter =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  const featured: FeaturedFilter =
    featuredRaw === "yes" || featuredRaw === "no" ? featuredRaw : "all";
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const where = {
    type,
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { slug: { contains: query } },
            { shortDescription: { contains: query } },
          ],
        }
      : {}),
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(featured === "yes" ? { isFeatured: true } : {}),
    ...(featured === "no" ? { isFeatured: false } : {}),
  };

  const { user } = await getAuthContext();
  const canEdit = can(user?.role, "content.edit");

  const [total, rows, counts] = await Promise.all([
    prisma.contentItem.count({ where }),
    prisma.contentItem.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    Promise.all(
      CONTENT_TYPES.map(async (t) => ({
        type: t,
        total: await prisma.contentItem.count({ where: { type: t } }),
        active: await prisma.contentItem.count({ where: { type: t, isActive: true } }),
      })),
    ),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const basePath = `/admin/content/${type}`;
  const sectionTitle = SECTION_TITLES[type];
  const publicPath = CONTENT_TYPE_PATHS[type];

  const buildHref = (target: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (status !== "all") next.set("status", status);
    if (featured !== "all") next.set("featured", featured);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const columns: Column<ContentItem>[] = [
    {
      key: "order",
      header: "الترتيب",
      className: "w-16",
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-ink-500">{row.order}</span>
      ),
    },
    {
      key: "title",
      header: "العنوان",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <span className="relative block size-12 shrink-0 overflow-hidden rounded-xl bg-brand-50 ring-1 ring-inset ring-sand-200 dark:bg-white/10 dark:ring-white/10">
            {row.image ? (
              <Image
                src={row.image}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized={row.image.startsWith("http")}
              />
            ) : (
              <span className="grid size-full place-items-center text-brand-600 dark:text-gold-300">
                <IconGlyph name={row.icon} className="size-5" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <Link
              href={`${basePath}/${row.id}`}
              className="block truncate font-bold text-brand-900 hover:text-brand-700 hover:underline dark:text-white"
            >
              {row.title}
            </Link>
            <span className="mt-0.5 block truncate text-xs text-ink-500" dir="ltr">
              /{row.slug}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "icon",
      header: "الأيقونة",
      hideBelow: "lg",
      cell: (row) => <ItemIconChip icon={row.icon} index={row.order} />,
    },
    {
      key: "flags",
      header: "الحالة",
      hideBelow: "sm",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.isActive ? "success" : "danger"}>
            {row.isActive ? "مفعّل" : "معطّل"}
          </Badge>
          {row.isFeatured && <Badge tone="gold">مميّز</Badge>}
        </span>
      ),
    },
    {
      key: "public",
      header: "المعاينة",
      hideBelow: "xl",
      cell: (row) =>
        row.isActive ? (
          <Link
            href={`${publicPath}/${row.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-brand-700 hover:underline"
          >
            عرض الصفحة
          </Link>
        ) : (
          <span className="text-xs text-ink-300">غير متاح</span>
        ),
    },
    {
      key: "actions",
      header: "إجراءات",
      headerClassName: "text-end",
      className: "text-end",
      cell: (row) => (
        <ContentRowActions
          id={row.id}
          type={type}
          title={row.title}
          index={rows.findIndex((candidate) => candidate.id === row.id)}
          total={rows.length}
          isActive={row.isActive}
          isFeatured={row.isFeatured}
          canEdit={canEdit}
        />
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        breadcrumb={[{ href: "/admin/content", label: "المحتوى" }]}
        title={sectionTitle}
        description={`رتّب ${sectionTitle}، عدّل نصوصها وصورها، وحدّد أيها يظهر على الصفحة الرئيسية. كل تغيير ينعكس على الموقع فورًا.`}
        action={
          <>
            <ButtonLink
              href="/admin/content"
              size="sm"
              variant="outline"
              icon={ArrowLeft}
            >
              كل الأقسام
            </ButtonLink>
            <ButtonLink href={`${basePath}/new`} size="sm" variant="primary" icon={Plus}>
              {CONTENT_TYPE_LABELS[type]} جديدة
            </ButtonLink>
          </>
        }
      />

      {/* Section switcher */}
      <nav aria-label="أقسام المحتوى" className="mb-5 flex flex-wrap gap-2">
        {CONTENT_TYPES.map((t) => {
          const info = counts.find((c) => c.type === t);
          const active = t === type;
          return (
            <Link
              key={t}
              href={`/admin/content/${t}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] font-bold transition-colors",
                active
                  ? "bg-brand-800 text-white shadow-soft"
                  : "bg-white text-ink-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-50 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10 dark:hover:bg-white/10",
              )}
            >
              {SECTION_TITLES[t]}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold",
                  active
                    ? "bg-white/15 text-gold-300"
                    : "bg-sand-100 text-ink-500 dark:bg-white/10",
                )}
              >
                {info?.active ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Filters — a plain GET form so it works without JavaScript too. */}
      <form
        method="get"
        className="mb-5 grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] dark:border-white/10 dark:bg-white/5"
      >
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-ink-400"
          >
            <Search className="size-4" />
          </span>
          <Input
            name="q"
            defaultValue={query}
            placeholder="ابحث بالعنوان أو الرابط…"
            className="ps-11"
            aria-label="بحث"
          />
        </div>
        <Select name="status" defaultValue={status} aria-label="فلتر الحالة">
          <option value="all">كل الحالات</option>
          <option value="active">المفعّلة فقط</option>
          <option value="inactive">المعطّلة فقط</option>
        </Select>
        <Select name="featured" defaultValue={featured} aria-label="فلتر التمييز">
          <option value="all">مميّز وغير مميّز</option>
          <option value="yes">المميّزة فقط</option>
          <option value="no">غير المميّزة فقط</option>
        </Select>
        <div className="flex items-center gap-2">
          <Button type="submit" size="md" icon={Filter} className="flex-1">
            تصفية
          </Button>
          {(query || status !== "all" || featured !== "all") && (
            <Link
              href={basePath}
              title="مسح عوامل التصفية"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-sand-100 text-ink-500 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-300"
            >
              <X className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        empty={
          query || status !== "all" || featured !== "all"
            ? "لا توجد نتائج مطابقة لعوامل التصفية."
            : `لا توجد ${sectionTitle} بعد — ابدأ بالإضافة.`
        }
        footer={
          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={total}
            buildHref={buildHref}
          />
        }
      />

      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        إجمالي {sectionTitle} في قاعدة البيانات:{" "}
        {counts.find((c) => c.type === type)?.total ?? 0} — المعطّل منها لا يظهر في الموقع.
      </p>
    </>
  );
}
