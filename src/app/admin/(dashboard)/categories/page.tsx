import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderTree, Plus, Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { AdminPageHeader } from "@/components/admin/shell";
import { StatCard } from "@/components/admin/widgets";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/admin/(dashboard)/posts/actions";
import { cn, formatNumber, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التصنيفات" };

const CONTROL =
  "h-10 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/15 dark:bg-white/10 dark:text-ink-100";

const BTN_SOFT =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-sand-100 px-3.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-sand-200 transition-colors hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10";

const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-800 px-4 text-xs font-bold text-white transition-colors hover:bg-brand-900";

const BTN_DANGER =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-danger-600 px-4 text-xs font-bold text-white transition-colors hover:bg-danger-700";

const HEAD_CELL =
  "whitespace-nowrap px-4 py-3.5 text-start text-xs font-extrabold uppercase tracking-wide text-ink-500";

const BODY_CELL = "px-4 py-3.5 align-middle text-[0.875rem] text-ink-700 dark:text-ink-200";

export default async function AdminCategoriesPage() {
  const { user } = await getAuthContext();
  if (!user || !can(user.role, "posts.edit")) redirect("/admin/posts");

  const [categories, total, active, unused] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { _count: { select: { posts: true } } },
    }),
    prisma.category.count(),
    prisma.category.count({ where: { isActive: true } }),
    prisma.category.count({ where: { posts: { none: {} } } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="تصنيفات المدونة"
        description="التصنيفات تنظّم المقالات في صفحة المدونة وتُستخدم للتصفية. الترتيب يحدد ظهورها."
        breadcrumb={[
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/posts", label: "المدونة" },
          { href: "/admin/categories", label: "التصنيفات" },
        ]}
        action={
          <>
            <ButtonLink href="/admin/posts" variant="outline" size="sm" icon={Tags}>
              المقالات
            </ButtonLink>
            <ButtonLink href="/admin/posts/new" variant="primary" size="sm" icon={Plus}>
              مقال جديد
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التصنيفات" value={total} icon={FolderTree} />
        <StatCard label="مفعّلة" value={active} tone="success" hint="تظهر للزوار" />
        <StatCard label="بدون مقالات" value={unused} tone="warn" hint="لم يُنشر تحتها شيء بعد" />
        <StatCard
          label="مقالات مصنّفة"
          value={total > 0 ? Math.max(0, total - unused) : 0}
          tone="gold"
          hint="تصنيفات مستخدمة فعليًا"
        />
      </div>

      {/* ── Add new ────────────────────────────────────── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
        <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-extrabold text-brand-900 dark:text-white">إضافة تصنيف جديد</h2>
        </header>
        <form
          action={async (formData) => {
            "use server";
            const { user: actor } = await getAuthContext();
            if (!actor) return;
            if (!can(actor.role, "posts.edit")) return;
            await createCategory({
              name: String(formData.get("name") ?? ""),
              slug: String(formData.get("slug") ?? ""),
              description: String(formData.get("description") ?? ""),
              order: Number(formData.get("order") ?? 0) || 0,
              isActive: formData.get("isActive") !== null,
            });
          }}
          className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-800">
            اسم التصنيف *
            <input name="name" required maxLength={80} placeholder="مثال: التعافي النفسي" className={CONTROL} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-800">
            الرابط (slug)
            <input
              name="slug"
              maxLength={120}
              dir="ltr"
              placeholder={slugify("التعافي النفسي")}
              className={CONTROL}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-800">
            الترتيب
            <input name="order" type="number" min={0} max={9999} defaultValue={0} className={CONTROL} />
          </label>
          <div className="flex items-end">
            <button type="submit" className={cn(BTN_PRIMARY, "h-10 w-full")}>
              <Plus className="size-3.5" aria-hidden />
              إضافة
            </button>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-800 sm:col-span-2 lg:col-span-3">
            وصف مختصر
            <textarea
              name="description"
              rows={2}
              maxLength={300}
              placeholder="يظهر في صفحة التصنيف عند مرور المؤشر."
              className={`${CONTROL} h-auto py-2.5`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-ink-800">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="size-5 rounded-md border-2 border-sand-400 accent-brand-700"
            />
            مفعّل
          </label>
        </form>
      </section>

      {/* ── Table ─────────────────────────────────────── */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <FolderTree className="size-8 text-ink-300" aria-hidden />
          <p className="font-bold text-ink-600 dark:text-ink-300">لا توجد تصنيفات بعد.</p>
          <Link href="/admin/posts" className="text-xs font-bold text-brand-700 hover:underline">
            ابدأ بكتابة مقال
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-start">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50 dark:border-white/10 dark:bg-white/5">
                  <th scope="col" className={HEAD_CELL}>الاسم</th>
                  <th scope="col" className={HEAD_CELL}>الرابط</th>
                  <th scope="col" className={HEAD_CELL}>الوصف</th>
                  <th scope="col" className={HEAD_CELL}>المقالات</th>
                  <th scope="col" className={HEAD_CELL}>الترتيب</th>
                  <th scope="col" className={HEAD_CELL}>الحالة</th>
                  <th scope="col" className={HEAD_CELL}>إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200 dark:divide-white/10">
                {categories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={{
                      id: category.id,
                      name: category.name,
                      slug: category.slug,
                      description: category.description ?? "",
                      order: category.order,
                      isActive: category.isActive,
                      postCount: category._count.posts,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

async function CategoryRow({
  category,
}: {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string;
    order: number;
    isActive: boolean;
    postCount: number;
  };
}) {
  const save = async (formData: FormData) => {
    "use server";
    const { user } = await getAuthContext();
    if (!user) return;
    if (!can(user.role, "posts.edit")) return;
    await updateCategory(category.id, {
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      order: Number(formData.get("order") ?? 0) || 0,
      isActive: formData.get("isActive") !== null,
    });
  };

  const remove = async () => {
    "use server";
    const { user } = await getAuthContext();
    if (!user) return;
    if (!can(user.role, "posts.edit")) return;
    await deleteCategory(category.id);
  };

  const toggle = async () => {
    "use server";
    const { user } = await getAuthContext();
    if (!user) return;
    if (!can(user.role, "posts.edit")) return;
    await updateCategory(category.id, {
      name: category.name,
      slug: category.slug,
      description: category.description,
      order: category.order,
      isActive: !category.isActive,
    });
  };

  return (
    <>
      <tr className="transition-colors hover:bg-sand-50 dark:hover:bg-white/5">
        <td className={BODY_CELL}>
          <span className="font-extrabold text-brand-900 dark:text-white">{category.name}</span>
        </td>
        <td className={BODY_CELL}>
          <span dir="ltr" className="text-xs text-ink-500">
            {category.slug}
          </span>
        </td>
        <td className={`${BODY_CELL} max-w-xs`}>
          <span className="line-clamp-2 text-xs text-ink-500">{category.description || "—"}</span>
        </td>
        <td className={BODY_CELL}>
          <Link
            href={`/admin/posts?category=${category.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:underline"
          >
            {formatNumber(category.postCount)} مقال
          </Link>
        </td>
        <td className={BODY_CELL}>
          <span className="text-xs font-bold text-ink-600 dark:text-ink-300">
            {formatNumber(category.order)}
          </span>
        </td>
        <td className={BODY_CELL}>
          <Badge tone={category.isActive ? "success" : "sand"}>
            {category.isActive ? "مفعّل" : "مخفي"}
          </Badge>
        </td>
        <td className={BODY_CELL}>
          {/* Two-step delete without any client JavaScript. */}
          <details className="relative inline-block">
            <summary className={`${BTN_SOFT} cursor-pointer list-none`}>
              تعديل
            </summary>
            <div className="absolute end-0 z-20 mt-2 w-[min(22rem,80vw)] rounded-2xl border border-sand-200 bg-white p-4 text-start shadow-lift dark:border-white/10 dark:bg-[#1b1524]">
              <form action={save} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-800">
                  الاسم
                  <input name="name" defaultValue={category.name} required maxLength={80} className={CONTROL} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-800">
                  الرابط (slug)
                  <input
                    name="slug"
                    dir="ltr"
                    defaultValue={category.slug}
                    maxLength={120}
                    className={CONTROL}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-800">
                  الوصف
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={category.description}
                    maxLength={300}
                    className={`${CONTROL} h-auto py-2`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-800">
                  الترتيب
                  <input
                    name="order"
                    type="number"
                    min={0}
                    max={9999}
                    defaultValue={category.order}
                    className={CONTROL}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-ink-800">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={category.isActive}
                    className="size-4 rounded accent-brand-700"
                  />
                  مفعّل
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={BTN_PRIMARY}>
                    حفظ
                  </button>
                  <button type="submit" formAction={toggle} className={BTN_SOFT}>
                    {category.isActive ? "إخفاء" : "تفعيل"}
                  </button>
                </div>
              </form>
            </div>
          </details>{" "}
          <details className="relative mt-2 inline-block align-middle">
            <summary className={`${BTN_SOFT} cursor-pointer list-none text-danger-600`}>حذف</summary>
            <div className="absolute end-0 z-20 mt-2 w-[min(18rem,80vw)] rounded-2xl border border-danger-100 bg-white p-4 text-start shadow-lift dark:border-danger-500/30 dark:bg-[#1b1524]">
              <p className="text-xs leading-relaxed text-ink-700 dark:text-ink-200">
                سيتم حذف «{category.name}». المقالات المرتبطة به ستبقى منشورة بدون تصنيف.
              </p>
              <form action={remove} className="mt-3 flex gap-2">
                <button type="submit" className={BTN_DANGER}>
                  تأكيد الحذف
                </button>
              </form>
            </div>
          </details>
        </td>
      </tr>
      {!category.isActive && (
        <tr className="bg-sand-50 dark:bg-white/5">
          <td colSpan={7} className="px-4 py-2 text-[0.6875rem] font-semibold text-ink-500">
            هذا التصنيف مخفي — لا يظهر للزوار حتى تُعيد تفعيله.
          </td>
        </tr>
      )}
    </>
  );
}