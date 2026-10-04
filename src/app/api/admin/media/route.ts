import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { saveUpload, deleteUpload, imageDimensions } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

/**
 * Media upload endpoint.
 *
 * POST   → multipart/form-data with `file` and an optional `folder` + `alt`.
 *          Returns the stored asset (id + public path) so the caller can save
 *          the URL on any record.
 * DELETE → removes a file, guarded by the "media.delete" capability.
 *
 * Only reachable by an authenticated user with the right permission; the check
 * lives here rather than relying on the layout, because route handlers do not
 * pass through it.
 */
export async function POST(request: NextRequest) {
  const context = await getAuthContext();
  if (!context.user) {
    return NextResponse.json({ ok: false, message: "غير مصرّح." }, { status: 401 });
  }
  if (!can(context.user.role, "media.upload")) {
    return NextResponse.json(
      { ok: false, message: "لا تملك صلاحية رفع الملفات." },
      { status: 403 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "general");
    const alt = String(form.get("alt") ?? "").slice(0, 200);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "لم يتم إرسال أي ملف." },
        { status: 400 },
      );
    }

    const stored = await saveUpload(file, folder);
    const dimensions = await imageDimensions(
      Buffer.from(await file.arrayBuffer()),
    ).catch(() => ({ width: null, height: null }));

    const asset = await prisma.mediaAsset.create({
      data: {
        filename: stored.filename,
        path: stored.path,
        mimeType: stored.mimeType,
        size: stored.size,
        width: dimensions.width,
        height: dimensions.height,
        alt: alt || null,
        folder,
        uploadedById: context.user.id,
      },
    });

    await logActivity({
      userId: context.user.id,
      userName: context.user.name,
      action: "UPLOAD",
      entity: "MediaAsset",
      entityId: asset.id,
      summary: `رفع ملف: ${stored.filename}`,
      ip: clientIpFrom(request.headers),
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذّر رفع الملف.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getAuthContext();
  if (!context.user) {
    return NextResponse.json({ ok: false, message: "غير مصرّح." }, { status: 401 });
  }
  if (!can(context.user.role, "media.delete")) {
    return NextResponse.json(
      { ok: false, message: "لا تملك صلاحية حذف الملفات." },
      { status: 403 },
    );
  }

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "معرّف الملف مطلوب." },
        { status: 400 },
      );
    }

    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json(
        { ok: false, message: "الملف غير موجود." },
        { status: 404 },
      );
    }

    await deleteUpload(asset.path);
    await prisma.mediaAsset.delete({ where: { id } });

    await logActivity({
      userId: context.user.id,
      userName: context.user.name,
      action: "DELETE",
      entity: "MediaAsset",
      entityId: id,
      summary: `حذف ملف: ${asset.filename}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذّر حذف الملف.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
