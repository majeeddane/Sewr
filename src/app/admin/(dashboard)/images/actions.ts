"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

/**
 * Server actions for the central image manager.
 *
 * Every image slot on the public site is listed in one place, so changing or
 * hiding an image does not mean hunting through six settings tabs. Two kinds of
 * slot exist and they are stored differently:
 *
 *  - global slots live in the single site_settings row
 *  - per-item slots live on the content item or post that owns them
 *
 * Both are handled here so the dashboard only needs one form shape.
 */

/** Global slots, expressed as setting-column pairs. */
const GLOBAL_SLOTS = [
  { path: "logoPath", alt: "logoAlt", hidden: null, label: "شعار الموقع" },
  { path: "faviconPath", alt: null, hidden: null, label: "أيقونة المتصفح" },
  { path: "heroImage", alt: "heroImageAlt", hidden: "heroImageHidden", label: "صورة الواجهة" },
  {
    path: "homeAboutImage",
    alt: "homeAboutImageAlt",
    hidden: "homeAboutImageHidden",
    label: "صورة قسم «من نحن»",
  },
  {
    path: "aboutVision2030Image",
    alt: "aboutVision2030ImageAlt",
    hidden: "aboutVision2030ImageHidden",
    label: "صورة منهجية التعافي",
  },
  { path: "ogImage", alt: null, hidden: null, label: "صورة المشاركة" },
] as const;

export interface ImageActionResult {
  ok: boolean;
  message: string;
}

/**
 * Saves a global image slot.
 *
 * `slot` names the site_settings column, `value` is the stored path. They are
 * deliberately separate: passing the URL where the column name belongs would
 * silently write to the wrong field.
 */
export async function saveGlobalImage(input: {
  slot: string;
  value: string | null;
  alt?: string | null;
  hidden?: boolean;
}): Promise<ImageActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { ok: false, message: "الجلسة منتهية. سجّل الدخول من جديد." };
  if (!can(context.user.role, "settings.edit")) {
    return { ok: false, message: "لا تملك صلاحية تعديل إعدادات الموقع." };
  }

  const target = GLOBAL_SLOTS.find((s) => s.path === input.slot);
  if (!target) return { ok: false, message: "خانة الصورة غير معروفة." };

  // An empty string means "cleared" → stored as NULL.
  const clean = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const data: Record<string, unknown> = { [target.path]: clean(input.value) };
  if (target.alt) data[target.alt] = clean(input.alt);
  if (target.hidden) data[target.hidden] = Boolean(input.hidden);

  await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await logActivity({
    action: "UPDATE",
    entity: "SiteSetting",
    summary: `تحديث صورة: ${target.label}`,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `حُفظت: ${target.label}` };
}

/** Shows or hides a global image slot without losing the file. */
export async function toggleGlobalImage(input: {
  slot: string;
  hidden: boolean;
}): Promise<ImageActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { ok: false, message: "الجلسة منتهية." };
  if (!can(context.user.role, "settings.edit")) {
    return { ok: false, message: "لا تملك صلاحية تعديل إعدادات الموقع." };
  }
  const target = GLOBAL_SLOTS.find((s) => s.path === input.slot);
  if (!target?.hidden) return { ok: false, message: "هذه الخانة لا تدعم الإخفاء." };

  await prisma.siteSetting.update({
    where: { id: "singleton" },
    data: { [target.hidden]: input.hidden },
  });

  await logActivity({
    action: "UPDATE",
    entity: "SiteSetting",
    summary: `${input.hidden ? "إخفاء" : "إظهار"} صورة: ${target.label}`,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: input.hidden ? "أُخفيت الصورة" : "أُظهرت الصورة" };
}

export type PerItemKind = "content" | "post";

/** Shows or hides the image on a single content item or blog post. */
export async function toggleItemImage(input: {
  kind: PerItemKind;
  id: string;
  hidden: boolean;
}): Promise<ImageActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { ok: false, message: "الجلسة منتهية." };
  if (!can(context.user.role, "content.edit")) {
    return { ok: false, message: "لا تملك صلاحية تعديل المحتوى." };
  }

  if (input.kind === "content") {
    await prisma.contentItem.update({
      where: { id: input.id },
      data: { imageHidden: input.hidden },
    });
  } else {
    await prisma.post.update({
      where: { id: input.id },
      data: { coverHidden: input.hidden },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: input.hidden ? "أُخفيت الصورة" : "أُظهرت الصورة" };
}

/** Clears a per-item image, returning the item to its placeholder. */
export async function clearItemImage(input: {
  kind: PerItemKind;
  id: string;
}): Promise<ImageActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { ok: false, message: "الجلسة منتهية." };
  if (!can(context.user.role, "content.edit")) {
    return { ok: false, message: "لا تملك صلاحية تعديل المحتوى." };
  }

  if (input.kind === "content") {
    await prisma.contentItem.update({
      where: { id: input.id },
      data: { image: null, imageAlt: null, imageHidden: false },
    });
  } else {
    await prisma.post.update({
      where: { id: input.id },
      data: { coverImage: null, coverImageAlt: null, coverHidden: false },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "أُزيلت الصورة" };
}
