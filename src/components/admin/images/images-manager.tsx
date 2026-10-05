"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Trash2, Pencil } from "lucide-react";
import { ImagePicker } from "@/components/admin/image-picker";
import { cn } from "@/lib/utils";
import {
  saveGlobalImage,
  toggleGlobalImage,
  toggleItemImage,
  clearItemImage,
} from "@/app/admin/(dashboard)/images/actions";

/**
 * One screen for every image on the public site.
 *
 * Each slot shows what is live now, and offers the three things an operator
 * actually needs: change it, hide it, or remove it. Hiding keeps the file so
 * the choice can be undone, which is why it is a separate action from clearing.
 */

export interface GlobalSlot {
  label: string;
  hint: string;
  /** The site_settings column that holds this image, e.g. "heroImage". */
  column: string;
  /** The currently stored image URL, or null. */
  path: string | null;
  alt: string | null;
  hidden: boolean;
  hideable: boolean;
  aspect: string;
  folder: string;
}

export interface ItemSlot {
  id: string;
  kind: "content" | "post";
  title: string;
  badge: string;
  href: string;
  image: string | null;
  hidden: boolean;
}

function Preview({
  src,
  alt,
  aspect,
  placeholder,
}: {
  src: string | null;
  alt: string;
  aspect: string;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-inset ring-sand-300 dark:bg-white/5 dark:ring-white/10",
        aspect,
      )}
    >
      {src ? (
        // The dashboard renders arbitrary uploaded paths, so a plain img is
        // required here rather than the optimised loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center px-3 text-center text-xs font-semibold text-ink-400">
          {placeholder}
        </span>
      )}
    </div>
  );
}

function HiddenBadge({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[0.6875rem] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
      <EyeOff className="size-3" aria-hidden />
      مخفية
    </span>
  ) : null;
}

/** Global slots: editable here, no need to open each settings tab. */
function GlobalCard({
  slot,
  canEdit,
}: {
  slot: GlobalSlot;
  canEdit: boolean;
}) {
  const altRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();

  const save = (value: string | null) =>
    startTransition(async () => {
      await saveGlobalImage({
        slot: slot.column,
        value,
        alt: altRef.current?.value ?? slot.alt,
        hidden: slot.hidden,
      });
    });

  const toggle = (hidden: boolean) =>
    startTransition(async () => {
      await toggleGlobalImage({ slot: slot.column, hidden });
    });

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-sand-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-brand-900 dark:text-white">{slot.label}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">{slot.hint}</p>
        </div>
        <HiddenBadge hidden={slot.hidden} />
      </header>

      <Preview
        src={slot.hidden ? null : slot.path}
        alt={slot.label}
        aspect={slot.aspect}
        placeholder="لا توجد صورة"
      />

      {canEdit ? (
        <>
          <ImagePicker
            name={`image-${slot.label}`}
            label="اختر صورة"
            value={slot.path}
            onChange={(v) => save(v)}
            folder={slot.folder}
            aspect={slot.aspect}
            hint="اختر من المكتبة أو ارفع ملفًا جديدًا."
          />

          <label className="block">
            <span className="text-[0.8125rem] font-bold text-ink-700 dark:text-ink-200">
              نص بديل الصورة (وصف للقارئ الصوتي وبمحركات البحث)
            </span>
            <input
              ref={altRef}
              type="text"
              key={slot.alt ?? ""}
              defaultValue={slot.alt ?? ""}
              onBlur={() => {
                const next = altRef.current?.value ?? "";
                if (slot.path && next !== (slot.alt ?? "")) save(slot.path);
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-white/5"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {slot.hideable && (
              <button
                type="button"
                onClick={() => toggle(!slot.hidden)}
                disabled={pending}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.8125rem] font-bold transition",
                  "border border-sand-300 text-ink-600 hover:bg-sand-100",
                  "disabled:opacity-50 dark:border-white/15 dark:text-ink-200 dark:hover:bg-white/10",
                )}
              >
                {slot.hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                {slot.hidden ? "إظهار الصورة" : "إخفاء الصورة"}
              </button>
            )}

            {slot.path && (
              <button
                type="button"
                onClick={() => save(null)}
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-danger-200 px-4 text-[0.8125rem] font-bold text-danger-700 transition hover:bg-danger-50 disabled:opacity-50 dark:border-danger-900/60 dark:text-danger-300 dark:hover:bg-danger-950/40"
              >
                <Trash2 className="size-4" aria-hidden />
                إزالة الصورة
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-400">لا تملك صلاحية تعديل الصور.</p>
      )}
    </article>
  );
}

/** Per-item slots: toggle visibility, or jump to the full editor. */
function ItemCard({
  item,
  canEdit,
}: {
  item: ItemSlot;
  canEdit: boolean;
}) {
  const [pending, startTransition] = React.useTransition();

  // Optimistic so the thumbnail reacts on click; the server action then
  // revalidates and the real value replaces it.
  const [local, setLocal] = React.useOptimistic(
    { hidden: item.hidden, image: item.image },
    (state, next: Partial<{ hidden: boolean; image: string | null }>) => ({
      ...state,
      ...next,
    }),
  );

  const run = (next: Partial<{ hidden: boolean; image: string | null }>, action: () => Promise<unknown>) =>
    startTransition(async () => {
      setLocal(next);
      await action();
    });

  return (
    <article className="flex flex-col gap-3">
      <div className="relative">
        <Preview
          src={local.hidden ? null : local.image}
          alt={item.title}
          aspect="aspect-[16/10]"
          placeholder={local.image ? "مخفية" : "بلا صورة"}
        />
        <span className="absolute start-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-800 dark:bg-brand-950/85 dark:text-brand-100">
          {item.badge}
        </span>
      </div>

      <h4 className="line-clamp-2 text-sm font-bold leading-snug text-brand-900 dark:text-white">
        {item.title}
      </h4>

      <div className="mt-auto flex flex-wrap gap-1.5">
        <Link
          href={item.href}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sand-300 px-3 text-[0.6875rem] font-bold text-ink-600 hover:bg-sand-100 dark:border-white/15 dark:text-ink-200 dark:hover:bg-white/10"
        >
          <Pencil className="size-3" aria-hidden />
          تعديل
        </Link>

        {canEdit && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  { hidden: !local.hidden },
                  () => toggleItemImage({ kind: item.kind, id: item.id, hidden: !local.hidden }),
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sand-300 px-3 text-[0.6875rem] font-bold text-ink-600 hover:bg-sand-100 disabled:opacity-50 dark:border-white/15 dark:text-ink-200 dark:hover:bg-white/10"
            >
              {local.hidden ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
              {local.hidden ? "إظهار" : "إخفاء"}
            </button>

            {local.image && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    { hidden: false, image: null },
                    () => clearItemImage({ kind: item.kind, id: item.id }),
                  )
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-danger-200 px-3 text-[0.6875rem] font-bold text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-900/60 dark:text-danger-300 dark:hover:bg-danger-950/40"
              >
                <Trash2 className="size-3" aria-hidden />
                إزالة
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function ImagesManager({
  globals,
  contentItems,
  posts,
  canEditSettings,
  canEditContent,
}: {
  globals: GlobalSlot[];
  contentItems: ItemSlot[];
  posts: ItemSlot[];
  canEditSettings: boolean;
  canEditContent: boolean;
}) {
  const withImages = contentItems.filter((i) => i.image).length;
  const postImages = posts.filter((p) => p.image).length;

  return (
    <div className="space-y-10">
      {/* ── Global images ── */}
      <section aria-labelledby="global-images">
        <h2 id="global-images" className="mb-1 text-lg font-extrabold text-brand-900 dark:text-white">
          صور الموقع
        </h2>
        <p className="mb-5 text-sm text-ink-500">
          صور تظهر في أكثر من موضع. تغييرها من هنا يسري على كل الصفحات.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {globals.map((slot) => (
            <GlobalCard key={slot.label} slot={slot} canEdit={canEditSettings} />
          ))}
        </div>
      </section>

      {/* ── Content images ── */}
      <section aria-labelledby="content-images">
        <h2 id="content-images" className="mb-1 text-lg font-extrabold text-brand-900 dark:text-white">
          صور الخدمات والبرامج
        </h2>
        <p className="mb-5 text-sm text-ink-500">
          {withImages} من {contentItems.length} عنصر له صورة. يمكنك الإخفاء هنا، والتعديل الكامل من صفحة العنصر.
        </p>

        {contentItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sand-300 p-8 text-center text-sm text-ink-400">
            لا يوجد محتوى بعد.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {contentItems.map((item) => (
              <ItemCard key={item.id} item={item} canEdit={canEditContent} />
            ))}
          </div>
        )}
      </section>

      {/* ── Blog covers ── */}
      <section aria-labelledby="post-images">
        <h2 id="post-images" className="mb-1 text-lg font-extrabold text-brand-900 dark:text-white">
          صور المقالات
        </h2>
        <p className="mb-5 text-sm text-ink-500">
          {postImages} من {posts.length} مقال له صورة غلاف.
        </p>

        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sand-300 p-8 text-center text-sm text-ink-400">
            لا توجد مقالات بعد.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {posts.map((post) => (
              <ItemCard key={post.id} item={post} canEdit={canEditContent} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}