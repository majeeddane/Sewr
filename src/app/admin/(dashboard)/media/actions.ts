"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sanitizeText } from "@/lib/sanitize";

/**
 * Media library Server Actions.
 *
 * Uploads and deletions go through /api/admin/media (which guards and logs
 * itself). Only the metadata edits that the library UI owns live here.
 */

export interface MediaActionResult {
  ok: boolean;
  message?: string;
}

const UNAUTHORIZED = "غير مصرّح.";

function fail(message: string): MediaActionResult {
  return { ok: false, message };
}

/**
 * Alt text is what makes an image reachable for screen-reader users and
 * indexed by search engines, so it is part of the content work — hence the
 * `media.upload` capability rather than plain viewing rights.
 */
export async function updateAlt(id: string, alt: string): Promise<MediaActionResult> {
  const { user } = await getAuthContext();
  if (!user) return fail(UNAUTHORIZED);
  if (!can(user.role, "media.upload")) {
    return fail("لا تملك صلاحية تعديل بيانات الوسائط.");
  }

  const cleanId = sanitizeText(id, 60);
  if (!cleanId) return fail("معرّف الملف مطلوب.");

  const cleanAlt = sanitizeText(alt, 200);
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: cleanId },
    select: { id: true, filename: true, alt: true },
  });
  if (!asset) return fail("الملف غير موجود.");

  await prisma.mediaAsset.update({
    where: { id: cleanId },
    data: { alt: cleanAlt || null },
  });

  if (asset.alt !== cleanAlt) {
    const hdrs = await headers();
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "MediaAsset",
      entityId: asset.id,
      summary: `تحديث النص البديل: ${asset.filename}`,
      ip: clientIpFrom(hdrs),
    });
  }

  revalidatePath("/admin/media");
  return { ok: true, message: "تم حفظ النص البديل." };
}