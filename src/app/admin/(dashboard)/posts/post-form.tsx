"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Eye,
  Hash,
  Loader2,
  Plus,
  Save,
  Send,
  Tag as TagIcon,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ImagePicker } from "@/components/admin/image-picker";
import { useAction } from "@/components/admin/use-action";
import { toast } from "@/components/ui/toast";
import {
  checkSlugAvailable,
  createCategory,
  createPost,
  updatePost,
  suggestSlug,
  type PostActionResult,
} from "@/app/admin/(dashboard)/posts/actions";
import { POST_STATUSES, POST_STATUS_LABELS, type PostStatus } from "@/lib/enums";
import { cn, readingMinutes, slugify, stripHtml, toDateTimeInputValue, truncate } from "@/lib/utils";

// TipTap touches `window` at import time, so it only ever runs in the browser.
const RichTextEditor = dynamic(
  () => import("@/components/admin/posts/rich-text-editor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        className="grid min-h-[28rem] place-items-center rounded-2xl border border-sand-300 bg-white text-sm text-ink-400 dark:border-white/15 dark:bg-white/5"
      >
        جارٍ تحميل محرّر المحتوى…
      </div>
    ),
  },
);

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface TagOption {
  id: string;
  name: string;
}

export interface AuthorOption {
  id: string;
  name: string;
  role: string;
}

export interface PostFormValues {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  coverImageAlt: string;
  categoryId: string;
  authorId: string;
  status: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  featuredOnHome: boolean;
  noIndex: boolean;
  seoTitle: string;
  seoDescription: string;
  tagIds: string[];
}

const EMPTY: PostFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: null,
  coverImageAlt: "",
  categoryId: "",
  authorId: "",
  status: "DRAFT",
  publishedAt: null,
  scheduledAt: null,
  featuredOnHome: false,
  noIndex: false,
  seoTitle: "",
  seoDescription: "",
  tagIds: [],
};

const INTENT_META: Record<
  PostStatus,
  { label: string; icon: typeof Save; variant: "outline" | "primary" | "gold" }
> = {
  DRAFT: { label: "حفظ كمسودة", icon: Save, variant: "outline" },
  PUBLISHED: { label: "نشر الآن", icon: Send, variant: "gold" },
  SCHEDULED: { label: "جدولة", icon: CalendarClock, variant: "primary" },
};

export function PostForm({
  post,
  categories,
  tags,
  authors,
}: {
  /** Omit to create a new post. */
  post?: PostFormValues;
  categories: CategoryOption[];
  tags: TagOption[];
  authors: AuthorOption[];
}) {
  const router = useRouter();
  const { run, pending } = useAction();

  const [values, setValues] = React.useState<PostFormValues>(post ?? EMPTY);
  const [intent, setIntent] = React.useState<PostStatus>(
    post && POST_STATUSES.includes(post.status as PostStatus)
      ? (post.status as PostStatus)
      : "DRAFT",
  );
  const [slugTouched, setSlugTouched] = React.useState(Boolean(post?.slug));
  const [slugHint, setSlugHint] = React.useState<string | null>(null);
  const [slugBusy, setSlugBusy] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");
  const [categoryBusy, setCategoryBusy] = React.useState(false);
  const [newTag, setNewTag] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Authoritative category list — grows when an inline category is created.
  const [categoryOptions, setCategoryOptions] = React.useState(categories);
  // Tag list merged with the ones typed in this session.
  const [tagOptions, setTagOptions] = React.useState<TagOption[]>(tags);

  const patch = React.useCallback(<K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  // The slug is *derived* from the Arabic title until the editor types one, so
  // no effect is needed to keep the two in sync.
  const autoSlug = React.useMemo(
    () => (slugTouched ? values.slug : slugify(values.title, "")),
    [slugTouched, values.slug, values.title],
  );

  const previewMinutes = React.useMemo(() => readingMinutes(values.content), [values.content]);
  const wordCount = React.useMemo(
    () => stripHtml(values.content).split(/\s+/).filter(Boolean).length,
    [values.content],
  );

  const status = values.status as PostStatus;

  const buildInput = (nextStatus: PostStatus) => ({
    title: values.title,
    slug: autoSlug,
    excerpt: values.excerpt,
    content: values.content,
    coverImage: values.coverImage ?? "",
    coverImageAlt: values.coverImageAlt,
    categoryId: values.categoryId,
    authorId: values.authorId,
    status: nextStatus,
    publishedAt:
      values.publishedAt ? toDateTimeInputValue(values.publishedAt) : toDateTimeInputValue(new Date()),
    scheduledAt: values.scheduledAt ? toDateTimeInputValue(values.scheduledAt) : "",
    featuredOnHome: values.featuredOnHome,
    noIndex: values.noIndex,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    // Every selected tag — existing or typed this session — is sent by name;
    // the Server Action upserts whatever is missing.
    tags: tagOptions.filter((tag) => values.tagIds.includes(tag.id)).map((tag) => tag.name),
  });

  const submit = async (nextStatus: PostStatus) => {
    setErrors({});
    setIntent(nextStatus);
    const payload = buildInput(nextStatus);

    const action = post?.id
      ? () => updatePost(post.id as string, payload)
      : () => createPost(payload);

    const result = await run<PostActionResult>(action);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast.error(result.message ?? "تعذّر حفظ المقال.");
      return;
    }

    toast.success(
      nextStatus === "PUBLISHED"
        ? "تم نشر المقال."
        : nextStatus === "SCHEDULED"
          ? "تمت جدولة المقال."
          : "تم حفظ المسودة.",
    );
    if (post?.id) {
      setValues((current) => ({ ...current, status: nextStatus }));
      router.refresh();
    } else if (result.id) {
      router.push(`/admin/posts/${result.id}`);
      router.refresh();
    }
  };

  const checkSlug = async () => {
    if (!autoSlug) {
      setSlugHint("اكتب عنوانًا أولًا ليُقترح الرابط.");
      return;
    }
    setSlugBusy(true);
    const result = await run<PostActionResult>(() => checkSlugAvailable(autoSlug, post?.id ?? null));
    setSlugBusy(false);
    setSlugHint(result.ok ? (result.message ?? "الرابط متاح.") : (result.message ?? null));
    if (result.ok && result.slug && result.slug !== autoSlug && !slugTouched) {
      setSlugTouched(true);
      patch("slug", result.slug);
    }
  };

  const regenerateSlug = async () => {
    const result = await run<PostActionResult>(() => suggestSlug(values.title));
    if (result.ok && result.slug) {
      setSlugTouched(true);
      patch("slug", result.slug);
      setSlugHint("أُعيد توليد الرابط من العنوان.");
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (name.length < 2) {
      toast.error("اكتب اسم التصنيف (حرفان على الأقل).");
      return;
    }
    setCategoryBusy(true);
    const result = await run<PostActionResult>(() => createCategory({ name }));
    setCategoryBusy(false);
    if (!result.ok || !result.id) return;
    setCategoryOptions((current) => [
      ...current,
      { id: result.id as string, name, slug: result.slug ?? slugify(name) },
    ]);
    patch("categoryId", result.id as string);
    setNewCategory("");
    toast.success("تمت إضافة التصنيف.");
  };

  const toggleTag = (id: string) => {
    setValues((current) => ({
      ...current,
      tagIds: current.tagIds.includes(id)
        ? current.tagIds.filter((t) => t !== id)
        : [...current.tagIds, id],
    }));
  };

  const addTag = () => {
    const name = newTag.trim().replace(/^#/, "");
    if (!name) return;
    const existing = tagOptions.find((tag) => tag.name === name);
    if (existing) {
      if (!values.tagIds.includes(existing.id)) toggleTag(existing.id);
    } else {
      // A provisional entry so the chip shows immediately; the Server Action
      // upserts the real row on save.
      const id = `new:${name}`;
      setTagOptions((current) => [...current, { id, name }]);
      setValues((current) =>
        current.tagIds.includes(id) ? current : { ...current, tagIds: [...current.tagIds, id] },
      );
    }
    setNewTag("");
  };

  const generateExcerpt = () => {
    const text = truncate(values.content || values.title, 190);
    if (!text) {
      toast.error("اكتب المحتوى أولًا لتوليد المقتطف.");
      return;
    }
    patch("excerpt", text);
  };

  const removeTag = (tag: TagOption) => {
    if (!values.tagIds.includes(tag.id)) return;
    toggleTag(tag.id);
    if (tag.id.startsWith("new:")) {
      setTagOptions((current) => current.filter((t) => t.id !== tag.id));
    }
  };

  const selectedTags = tagOptions.filter((t) => values.tagIds.includes(t.id));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // The footer buttons carry `name="intent"` + `value="<STATUS>"`, so the
        // intent is read from the submitter rather than from React state —
        // pressing Enter in a field then falls back to the status select.
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const raw = submitter?.getAttribute("value") ?? "";
        const nextStatus = (POST_STATUSES as readonly string[]).includes(raw)
          ? (raw as PostStatus)
          : intent;
        void submit(nextStatus);
      }}
      className="flex flex-col gap-5"
    >
      {/* ── Main column ─────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          {/* Title / slug */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">العنوان والرابط</h2>
            </header>
            <div className="flex flex-col gap-4 p-5">
              <Field
                label="العنوان"
                htmlFor="post-title"
                required
                error={errors.title}
                hint="عنوان واضح يصف فائدة القارئ. يُستخدم في نتائج البحث أيضًا."
              >
                <Input
                  id="post-title"
                  value={values.title}
                  onChange={(event) => {
                    setSlugHint(null);
                    patch("title", event.target.value);
                  }}
                  placeholder="مثال: خمس خطوات للتعافي بعد فترة إجهاد"
                  maxLength={200}
                  invalid={Boolean(errors.title)}
                  autoFocus={!post?.id}
                />
              </Field>

              <Field
                label="الرابط (slug)"
                htmlFor="post-slug"
                error={errors.slug}
                hint={
                  slugHint ??
                  "يُولَّد تلقائيًا من العنوان. يمكنك تعديله، وسيتولّى النظام ضمان عدم تكراره."
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 start-3 my-auto text-sm text-ink-400"
                      dir="ltr"
                    >
                      /blog/
                    </span>
                    <Input
                      id="post-slug"
                      dir="ltr"
                      className="ps-16"
                      value={autoSlug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setSlugHint(null);
                        patch("slug", event.target.value);
                      }}
                      placeholder="my-post-slug"
                      invalid={Boolean(errors.slug)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      disabled={slugBusy || pending}
                      onClick={() => void checkSlug()}
                      icon={slugBusy ? undefined : Check}
                      className="shrink-0"
                    >
                      {slugBusy ? "جارٍ الفحص…" : "تحقق"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || !values.title}
                      onClick={() => void regenerateSlug()}
                      icon={Wand2}
                      className="shrink-0"
                    >
                      توليد
                    </Button>
                  </div>
                </div>
              </Field>
            </div>
          </section>

          {/* Excerpt */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">المقتطف</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateExcerpt}
                icon={Wand2}
                disabled={pending}
              >
                توليد من المحتوى
              </Button>
            </header>
            <div className="p-5">
              <Field
                htmlFor="post-excerpt"
                error={errors.excerpt}
                hint={`وصف مختصر يظهر في بطاقة المقال ونتائج البحث — ${values.excerpt.length}/400 حرف.`}
                label="المقتطف"
                required
              >
                <Textarea
                  id="post-excerpt"
                  rows={3}
                  value={values.excerpt}
                  onChange={(event) => patch("excerpt", event.target.value)}
                  placeholder="جملة أو جملتان تلخّان جوهر المقال."
                  maxLength={400}
                  invalid={Boolean(errors.excerpt)}
                />
              </Field>
            </div>
          </section>

          {/* Body */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">المحتوى</h2>
              <p className="text-xs text-ink-500">
                {wordCount} كلمة · وقت قراءة {previewMinutes} دقيقة
              </p>
            </header>
            <div className="p-5">
              <RichTextEditor
                value={values.content}
                onChange={(html) => patch("content", html)}
                invalid={Boolean(errors.content)}
              />
              {errors.content && (
                <p role="alert" className="mt-2 text-[0.8125rem] font-semibold text-danger-600">
                  {errors.content}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ── Sidebar ────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Status */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">النشر</h2>
            </header>
            <div className="flex flex-col gap-4 p-5">
              <Field label="الحالة" htmlFor="post-status" required>
                <Select
                  id="post-status"
                  value={status}
                  onChange={(event) => {
                    const next = event.target.value as PostStatus;
                    patch("status", next);
                    setIntent(next);
                  }}
                >
                  {POST_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {POST_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>

              {status === "SCHEDULED" && (
                <Field
                  label="تاريخ النشر المجدول"
                  htmlFor="post-scheduled"
                  required
                  error={errors.scheduledAt}
                  hint="سيُنشر المقال تلقائيًا عند حلول هذا الموعد. يجب أن يكون في المستقبل."
                >
                  <Input
                    id="post-scheduled"
                    type="datetime-local"
                    value={values.scheduledAt ? toDateTimeInputValue(values.scheduledAt) : ""}
                    onChange={(event) =>
                      patch("scheduledAt", event.target.value ? new Date(event.target.value) : null)
                    }
                    invalid={Boolean(errors.scheduledAt)}
                  />
                </Field>
              )}

              {status !== "DRAFT" && (
                <Field
                  label="تاريخ النشر"
                  htmlFor="post-published"
                  optional
                  hint="اتركه فارغًا لاستخدام اللحظة الحالية."
                >
                  <Input
                    id="post-published"
                    type="datetime-local"
                    value={values.publishedAt ? toDateTimeInputValue(values.publishedAt) : ""}
                    onChange={(event) =>
                      patch("publishedAt", event.target.value ? new Date(event.target.value) : null)
                    }
                  />
                </Field>
              )}

              {status === "SCHEDULED" && (
                <p className="flex items-start gap-2 rounded-xl bg-warn-50 p-3 text-xs leading-relaxed font-semibold text-warn-700 dark:bg-amber-500/15 dark:text-amber-200">
                  <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  المقال لن يظهر في الموقع قبل الموعد المحدد، وينشره النظام تلقائيًا عند حلوله.
                </p>
              )}

              <Checkbox
                id="post-featured"
                label="إبراز في الصفحة الرئيسية"
                description="يظهر ضمن المقالات المختارة في قسم المدونة بالصفحة الرئيسية."
                checked={values.featuredOnHome}
                onChange={(event) => patch("featuredOnHome", event.target.checked)}
              />
              <Checkbox
                id="post-noindex"
                label="منع الفهرسة (noindex)"
                description="يمنع محركات البحث من عرض المقال، مع بقاء الرابط متاحًا للزوار."
                checked={values.noIndex}
                onChange={(event) => patch("noIndex", event.target.checked)}
              />
            </div>
          </section>

          {/* Cover image */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">صورة الغلاف</h2>
            </header>
            <div className="flex flex-col gap-4 p-5">
              <ImagePicker
                name="coverImage"
                label="صورة الغلاف"
                value={values.coverImage}
                onChange={(value) => patch("coverImage", value)}
                folder="blog"
                aspect="aspect-[16/9]"
                hint="مقاس مقترح ١٢٠٠×٦٧٥ بكسل."
              />
              <Field
                label="النص البديل للصورة"
                htmlFor="post-cover-alt"
                optional
                hint="وصف موجز لقارئات الشاشة ومحركات البحث."
              >
                <Input
                  id="post-cover-alt"
                  value={values.coverImageAlt}
                  onChange={(event) => patch("coverImageAlt", event.target.value)}
                  placeholder="مثال: جلسة جماعية في قاعة الإحاطة"
                  maxLength={200}
                />
              </Field>
            </div>
          </section>

          {/* Taxonomy */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">التصنيف والوسوم</h2>
            </header>
            <div className="flex flex-col gap-4 p-5">
              <Field label="التصنيف" htmlFor="post-category">
                <Select
                  id="post-category"
                  value={values.categoryId}
                  onChange={(event) => patch("categoryId", event.target.value)}
                >
                  <option value="">بدون تصنيف</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink-700 dark:text-ink-200">
                  إضافة تصنيف جديد
                </span>
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addCategory();
                      }
                    }}
                    placeholder="اسم التصنيف"
                    maxLength={80}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() => void addCategory()}
                    disabled={categoryBusy || pending}
                    className="shrink-0"
                    icon={categoryBusy ? undefined : Plus}
                  >
                    {categoryBusy ? "…" : "إضافة"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink-700 dark:text-ink-200">الوسوم</span>
                {selectedTags.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <li key={tag.id}>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 ps-2.5 pe-1 text-[0.6875rem] font-bold text-brand-800 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
                          <Hash className="size-3" aria-hidden />
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`إزالة الوسم ${tag.name}`}
                            className="grid size-4 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-white/15"
                          >
                            <X className="size-2.5" aria-hidden />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="وسم جديد ثم Enter"
                    maxLength={60}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={addTag}
                    disabled={pending}
                    className="shrink-0"
                    icon={TagIcon}
                  >
                    إضافة
                  </Button>
                </div>

                {tagOptions.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-bold text-brand-700 hover:underline">
                      اختيار من الوسوم الحالية ({tagOptions.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tagOptions.map((tag) => {
                        const active = values.tagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            aria-pressed={active}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ring-1 ring-inset transition-colors",
                              active
                                ? "bg-brand-800 text-white ring-brand-800"
                                : "bg-sand-100 text-ink-700 ring-sand-200 hover:bg-sand-200 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10",
                            )}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </section>

          {/* Author + SEO */}
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft dark:border-white/10 dark:bg-white/5">
            <header className="border-b border-sand-200 px-5 py-4 dark:border-white/10">
              <h2 className="text-base font-extrabold text-brand-900 dark:text-white">المؤلف وSEO</h2>
            </header>
            <div className="flex flex-col gap-4 p-5">
              <Field label="المؤلف" htmlFor="post-author">
                <Select
                  id="post-author"
                  value={values.authorId}
                  onChange={(event) => patch("authorId", event.target.value)}
                >
                  <option value="">اختر المؤلف</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="عنوان SEO" htmlFor="post-seo-title" optional>
                <Input
                  id="post-seo-title"
                  value={values.seoTitle}
                  onChange={(event) => patch("seoTitle", event.target.value)}
                  placeholder={values.title || "عنوان يظهر في نتائج البحث"}
                  maxLength={200}
                />
              </Field>

              <Field
                label="وصف SEO"
                htmlFor="post-seo-description"
                optional
                hint={`${values.seoDescription.length}/320 حرف — يظهر أسفل العنوان في نتائج البحث.`}
              >
                <Textarea
                  id="post-seo-description"
                  rows={3}
                  value={values.seoDescription}
                  onChange={(event) => patch("seoDescription", event.target.value)}
                  placeholder="وصف يشرح للقارئ ما سيحصل عليه من قراءة المقال."
                  maxLength={320}
                />
              </Field>
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer actions ──────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 bg-white/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-[#14101c]/90">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(INTENT_META) as PostStatus[]).map((key) => {
            const meta = INTENT_META[key];
            const Icon = meta.icon;
            return (
              <Button
                key={key}
                type="submit"
                name="intent"
                value={key}
                variant={meta.variant}
                size="sm"
                icon={Icon}
                loading={pending && intent === key}
                disabled={pending}
                onClick={() => setIntent(key)}
              >
                «{meta.label}»
              </Button>
            );
          })}
          {post?.id && (
            <ButtonLink
              href={`/blog/${autoSlug || ""}`}
              size="sm"
              variant="ghost"
              icon={Eye}
            >
              معاينة
            </ButtonLink>
          )}
          {post?.id && (
            <ButtonLink href="/admin/posts" size="sm" variant="ghost" icon={Trash2}>
              إلغاء والعودة
            </ButtonLink>
          )}
        </div>

        <p className="text-xs text-ink-500 dark:text-ink-400">
          {pending ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-brand-700 dark:text-brand-200">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </span>
          ) : (
            "سيُنظَّف المحتوى تلقائيًا قبل الحفظ، ويُعاد حساب وقت القراءة."
          )}
        </p>
      </div>
    </form>
  );
}

export default PostForm;