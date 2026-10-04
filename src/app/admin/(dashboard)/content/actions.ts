"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, clientIpFrom } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { sanitizeRichText, sanitizeText } from "@/lib/sanitize";
import { slugify, stringifyJson, uniqueSlug } from "@/lib/utils";
import { fieldErrors } from "@/lib/validation";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  isContentType,
  type ContentType,
} from "@/lib/enums";

// ═══════════════════════════════════════════════════════════════
//  Contract shared with `useAction()` — { ok, message?, errors? }
// ═══════════════════════════════════════════════════════════════

export type ContentActionResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const DENIED: ContentActionResult = { ok: false, message: "غير مصرّح." };
const FORBIDDEN: ContentActionResult = {
  ok: false,
  message: "لا تملك صلاحية تعديل المحتوى.",
};

async function currentIp(): Promise<string | null> {
  const hdrs = await headers();
  return clientIpFrom(hdrs);
}

/**
 * Every content screen renders straight from the database, so any write has to
 * invalidate the dashboard routes *and* the public pages that consume the same
 * rows — otherwise the site would keep showing yesterday's copy.
 */
function revalidateContentPaths(type?: string | null): void {
  // Dashboard.
  revalidatePath("/admin/content");
  revalidatePath("/admin/content/blocks");
  revalidatePath("/admin/content/[type]", "page");
  if (type) {
    revalidatePath(`/admin/content/${type}`);
    revalidatePath(`/admin/content/${type}/[id]`, "page");
  }

  // Public site.
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/programs");
  revalidatePath("/protocols");
  revalidatePath("/about");
  revalidatePath("/services/[slug]", "page");
  revalidatePath("/programs/[slug]", "page");
  revalidatePath("/protocols/[slug]", "page");
}

// ── Shared field helpers ───────────────────────────────────────

/** Empty strings become NULL so the public renderer can use `?? fallback`. */
function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text.length ? text : null;
}

const boolField = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "on", "1", "yes"].includes(value.trim().toLowerCase());
  return false;
}, z.boolean());

const orderField = z.coerce
  .number({ error: "الترتيب يجب أن يكون رقمًا." })
  .int("الترتيب يجب أن يكون رقمًا صحيحًا.")
  .min(0, "الترتيب لا يمكن أن يكون سالبًا.")
  .max(9999, "الترتيب كبير جدًا.");

const iconField = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().max(60, "اسم الأيقونة طويل جدًا.").nullable().optional(),
);

function textField(max: number, message?: string) {
  return z
    .string()
    .trim()
    .max(max, message ?? `الحد الأقصى ${max} حرفًا.`)
    .nullable()
    .optional();
}

function requiredTextField(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .min(min, message)
    .max(max, `الحد الأقصى ${max} حرفًا.`);
}

/** Keeps only rows that actually carry content, so empty repeater rows vanish. */
function cleanStringList(values: string[] | undefined, max = 300): string[] {
  return (values ?? [])
    .map((value) => sanitizeText(value, max))
    .filter((value) => value.length > 0);
}

// ═══════════════════════════════════════════════════════════════
//  ContentItem — خدمات / برامج / بروتوكولات
// ═══════════════════════════════════════════════════════════════

const stepSchema = z.object({
  title: z.string().trim().max(160, "عنوان الخطوة طويل جدًا."),
  description: z.string().trim().max(2000, "وصف الخطوة طويل جدًا."),
});

const faqPairSchema = z.object({
  question: z.string().trim().min(3, "السؤال مطلوب.").max(300, "السؤال طويل جدًا."),
  answer: z.string().trim().min(3, "الإجابة مطلوبة.").max(3000, "الإجابة طويلة جدًا."),
});

const contentItemSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: z.enum(CONTENT_TYPES, { error: "نوع المحتوى غير معروف." }),
  title: requiredTextField(2, 200, "العنوان مطلوب."),
  slug: z.string().trim().max(200, "الرابط طويل جدًا.").nullable().optional(),
  shortDescription: requiredTextField(5, 400, "الوصف المختصر مطلوب."),
  fullDescription: z.string().max(80_000, "الوصف الكامل طويل جدًا.").nullable().optional(),
  icon: iconField,
  image: textField(500, "رابط الصورة طويل جدًا."),
  imageAlt: textField(200),
  audience: textField(3000, "النص طويل جدًا."),
  steps: z.array(stepSchema).max(10, "الحد الأقصى 10 خطوات."),
  benefits: z.array(z.string()).max(30),
  outcomes: z.array(z.string()).max(30),
  notes: z.array(z.string()).max(30),
  faqs: z.array(faqPairSchema).max(30, "الحد الأقصى 30 سؤالًا."),
  durationLabel: textField(80),
  seoTitle: textField(200),
  seoDescription: textField(400),
  order: orderField.optional(),
  isActive: boolField.optional(),
  isFeatured: boolField.optional(),
});

export interface ContentItemPayload {
  id?: string | null;
  type: string;
  title: string;
  slug?: string | null;
  shortDescription: string;
  fullDescription?: string | null;
  icon?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  audience?: string | null;
  steps?: Array<{ title: string; description: string }>;
  benefits?: string[];
  outcomes?: string[];
  notes?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  durationLabel?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  order?: number | null;
  isActive?: boolean;
  isFeatured?: boolean;
}

export async function saveContentItem(
  input: ContentItemPayload,
): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  const parsed = contentItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "تحقّق من الحقول المعلّمة.", errors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const type = data.type as ContentType;

  // ── Slug: unique per (type, slug) ──
  const desired = (data.slug ?? "").trim() || data.title;
  const slug = await uniqueSlug(slugify(desired), async (candidate) => {
    const clash = await prisma.contentItem.findUnique({
      where: { type_slug: { type, slug: candidate } },
      select: { id: true },
    });
    return Boolean(clash && clash.id !== data.id);
  });

  const title = sanitizeText(data.title, 200);
  const steps = (data.steps ?? [])
    .map((step) => ({
      title: sanitizeText(step.title, 160),
      description: sanitizeText(step.description, 2000),
    }))
    .filter((step) => step.title.length > 0 || step.description.length > 0);

  const faqs = (data.faqs ?? []).map((faq) => ({
    question: sanitizeText(faq.question, 300),
    answer: sanitizeText(faq.answer, 3000),
  }));

  const shared = {
    title,
    slug,
    shortDescription: sanitizeText(data.shortDescription, 400),
    // The only field that keeps markup — always filtered by the allow-list.
    fullDescription: sanitizeRichText(data.fullDescription ?? ""),
    icon: blankToNull(data.icon),
    image: blankToNull(data.image),
    imageAlt: blankToNull(data.imageAlt),
    audience: blankToNull(data.audience),
    stepsJson: stringifyJson(steps),
    benefitsJson: stringifyJson(cleanStringList(data.benefits)),
    outcomesJson: stringifyJson(cleanStringList(data.outcomes)),
    notesJson: stringifyJson(cleanStringList(data.notes)),
    faqsJson: stringifyJson(faqs),
    durationLabel: blankToNull(data.durationLabel),
    seoTitle: blankToNull(data.seoTitle),
    seoDescription: blankToNull(data.seoDescription),
    isActive: data.isActive ?? true,
    isFeatured: data.isFeatured ?? false,
  };

  const ip = await currentIp();

  try {
    if (data.id) {
      const existing = await prisma.contentItem.findFirst({
        where: { id: data.id, type },
        select: { id: true },
      });
      if (!existing) {
        return { ok: false, message: "العنصر غير موجود." };
      }

      await prisma.contentItem.update({
        where: { id: existing.id },
        data: {
          ...shared,
          ...(data.order === undefined ? {} : { order: data.order }),
        },
      });

      await logActivity({
        userId: user.id,
        userName: user.name,
        action: "UPDATE",
        entity: "ContentItem",
        entityId: existing.id,
        summary: `تعديل ${CONTENT_TYPE_LABELS[type]} «${title}»`,
        ip,
      });

      revalidateContentPaths(type);
      return { ok: true, message: "تم حفظ التعديلات." };
    }

    const last = await prisma.contentItem.findFirst({
      where: { type },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const created = await prisma.contentItem.create({
      data: {
        ...shared,
        type,
        order: data.order ?? (last ? last.order + 1 : 0),
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "ContentItem",
      entityId: created.id,
      summary: `إضافة ${CONTENT_TYPE_LABELS[type]} «${title}»`,
      ip,
    });

    revalidateContentPaths(type);
    return { ok: true, message: "تمت الإضافة بنجاح." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message.includes("Unique constraint")
          ? "الرابط المختصر مستخدم في عنصر آخر. اختر رابطًا مختلفًا."
          : "تعذّر حفظ العنصر.",
    };
  }
}

export async function deleteContentItem(input: {
  id: string;
  type?: string | null;
}): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, message: "معرّف العنصر مفقود." };

  const existing = await prisma.contentItem.findUnique({
    where: { id },
    select: { id: true, title: true, type: true },
  });
  if (!existing) return { ok: false, message: "العنصر غير موجود." };

  // The list row must belong to the section the editor is looking at.
  if (input.type && !isContentType(input.type)) {
    return { ok: false, message: "نوع المحتوى غير معروف." };
  }

  await prisma.contentItem.delete({ where: { id: existing.id } });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "ContentItem",
    entityId: existing.id,
    summary: `حذف ${CONTENT_TYPE_LABELS[existing.type as ContentType] ?? "محتوى"} «${existing.title}»`,
    ip: await currentIp(),
  });

  revalidateContentPaths(existing.type);
  return { ok: true, message: "تم الحذف." };
}

/**
 * Accepts either an explicit ordered id list or a neighbour swap. The explicit
 * list is what the block editor uses; the swap is what the ▲▼ buttons use so
 * the buttons keep working while a search filter or pagination is applied.
 */
export async function reorderContentItems(input: {
  type: string;
  ids?: string[];
  id?: string;
  direction?: "up" | "down";
}): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  if (!isContentType(input.type)) {
    return { ok: false, message: "نوع المحتوى غير معروف." };
  }
  const type = input.type;

  const rows = await prisma.contentItem.findMany({
    where: { type },
    select: { id: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const ordered = rows.map((row) => row.id);

  if (Array.isArray(input.ids) && input.ids.length) {
    const known = new Set(ordered);
    const requested = input.ids.filter((id) => known.has(id));
    for (const id of ordered) {
      if (!requested.includes(id)) requested.push(id);
    }
    await persistContentOrder(requested);
  } else if (input.id && (input.direction === "up" || input.direction === "down")) {
    const index = ordered.indexOf(input.id);
    const target = input.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return { ok: false, message: "لا يوجد عنصر في هذا الاتجاه." };
    }
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    await persistContentOrder(next);
  } else {
    return { ok: false, message: "طلب الترتيب غير صالح." };
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "ContentItem",
    entityId: input.id ?? null,
    summary: `إعادة ترتيب ${CONTENT_TYPE_LABELS[type]}`,
    ip: await currentIp(),
  });

  revalidateContentPaths(type);
  return { ok: true, message: "تم تحديث الترتيب." };
}

async function persistContentOrder(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.contentItem.update({ where: { id }, data: { order: index + 1 } }),
    ),
  );
}

export async function toggleContentItem(input: {
  id: string;
  field: "isActive" | "isFeatured";
  value: boolean;
}): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  const id = (input.id ?? "").trim();
  const field = input.field;
  if (!id || (field !== "isActive" && field !== "isFeatured")) {
    return { ok: false, message: "طلب غير صالح." };
  }

  const existing = await prisma.contentItem.findUnique({
    where: { id },
    select: { id: true, type: true, title: true },
  });
  if (!existing) return { ok: false, message: "العنصر غير موجود." };

  const value = Boolean(input.value);
  await prisma.contentItem.update({ where: { id: existing.id }, data: { [field]: value } });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: value ? "PUBLISH" : "UNPUBLISH",
    entity: "ContentItem",
    entityId: existing.id,
    summary: `${field === "isActive" ? (value ? "تفعيل" : "تعطيل") : value ? "تمييز" : "إلغاء تمييز"} «${existing.title}»`,
    ip: await currentIp(),
  });

  revalidateContentPaths(existing.type);
  return {
    ok: true,
    message:
      field === "isActive" ? (value ? "تم التفعيل." : "تم التعطيل.") : "تم تحديث التمييز.",
  };
}

// ═══════════════════════════════════════════════════════════════
//  Ordered blocks — شريط الثقة / المنهجية / القيم / لماذا /
//  الإحصائيات / الآراء / الأسئلة الشائعة
// ═══════════════════════════════════════════════════════════════

const BLOCK_MODELS = [
  "TrustItem",
  "ProcessStep",
  "ValueItem",
  "WhyItem",
  "Statistic",
  "Testimonial",
  "Faq",
] as const;

type BlockModel = (typeof BLOCK_MODELS)[number];

function isBlockModel(value: unknown): value is BlockModel {
  return typeof value === "string" && (BLOCK_MODELS as readonly string[]).includes(value);
}

const ICON_BLOCK_DEFAULTS: Record<
  "TrustItem" | "ProcessStep" | "ValueItem" | "WhyItem",
  string
> = {
  TrustItem: "BadgeCheck",
  ProcessStep: "Compass",
  ValueItem: "Gem",
  WhyItem: "Star",
};

const blockSchemas = {
  TrustItem: z.object({
    id: z.string().trim().min(1).optional(),
    title: requiredTextField(2, 200, "العنوان مطلوب."),
    description: textField(1000),
    icon: iconField,
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  ProcessStep: z.object({
    id: z.string().trim().min(1).optional(),
    title: requiredTextField(2, 200, "العنوان مطلوب."),
    description: requiredTextField(5, 2000, "الوصف مطلوب."),
    icon: iconField,
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  ValueItem: z.object({
    id: z.string().trim().min(1).optional(),
    title: requiredTextField(2, 200, "العنوان مطلوب."),
    description: requiredTextField(5, 2000, "الوصف مطلوب."),
    icon: iconField,
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  WhyItem: z.object({
    id: z.string().trim().min(1).optional(),
    title: requiredTextField(2, 200, "العنوان مطلوب."),
    description: requiredTextField(5, 2000, "الوصف مطلوب."),
    icon: iconField,
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  Statistic: z.object({
    id: z.string().trim().min(1).optional(),
    label: requiredTextField(2, 120, "التسمية مطلوبة."),
    value: requiredTextField(1, 40, "القيمة مطلوبة."),
    prefix: textField(10),
    suffix: textField(10),
    icon: iconField,
    isHighlight: boolField.optional(),
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  Testimonial: z.object({
    id: z.string().trim().min(1).optional(),
    quote: requiredTextField(5, 1500, "نص الرأي مطلوب."),
    authorName: textField(120),
    authorRole: textField(120),
    rating: z.coerce
      .number({ error: "التقييم مطلوب." })
      .int("التقييم يجب أن يكون رقمًا صحيحًا.")
      .min(1, "التقييم من 1 إلى 5.")
      .max(5, "التقييم من 1 إلى 5."),
    isAnonymous: boolField.optional(),
    image: textField(500, "رابط الصورة طويل جدًا."),
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
  Faq: z.object({
    id: z.string().trim().min(1).optional(),
    question: requiredTextField(3, 300, "السؤال مطلوب."),
    answer: requiredTextField(3, 3000, "الإجابة مطلوبة."),
    category: z.string().trim().max(80, "التصنيف طويل جدًا.").optional(),
    order: orderField.optional(),
    isActive: boolField.optional(),
  }),
} satisfies Record<BlockModel, z.ZodType>;

// ── Order persistence for every block model ────────────────────

type OrderedRow = { id: string; order: number };

const ORDER_READERS: Record<
  BlockModel,
  () => Promise<Array<{ id: string; order: number }>>
> = {
  TrustItem: () =>
    prisma.trustItem.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  ProcessStep: () =>
    prisma.processStep.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  ValueItem: () =>
    prisma.valueItem.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  WhyItem: () =>
    prisma.whyItem.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  Statistic: () =>
    prisma.statistic.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  Testimonial: () =>
    prisma.testimonial.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
  Faq: () =>
    prisma.faq.findMany({
      select: { id: true, order: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
};

const ORDER_WRITERS: Record<
  BlockModel,
  (rows: OrderedRow[]) => Promise<unknown>
> = {
  TrustItem: (rows) =>
    prisma.$transaction(
      rows.map((row) => prisma.trustItem.update({ where: { id: row.id }, data: { order: row.order } })),
    ),
  ProcessStep: (rows) =>
    prisma.$transaction(
      rows.map((row) =>
        prisma.processStep.update({ where: { id: row.id }, data: { order: row.order } }),
      ),
    ),
  ValueItem: (rows) =>
    prisma.$transaction(
      rows.map((row) =>
        prisma.valueItem.update({ where: { id: row.id }, data: { order: row.order } }),
      ),
    ),
  WhyItem: (rows) =>
    prisma.$transaction(
      rows.map((row) => prisma.whyItem.update({ where: { id: row.id }, data: { order: row.order } })),
    ),
  Statistic: (rows) =>
    prisma.$transaction(
      rows.map((row) => prisma.statistic.update({ where: { id: row.id }, data: { order: row.order } })),
    ),
  Testimonial: (rows) =>
    prisma.$transaction(
      rows.map((row) =>
        prisma.testimonial.update({ where: { id: row.id }, data: { order: row.order } }),
      ),
    ),
  Faq: (rows) =>
    prisma.$transaction(
      rows.map((row) => prisma.faq.update({ where: { id: row.id }, data: { order: row.order } })),
    ),
};

/** Rewrites `order` for the whole list so the sequence is always 1..n. */
async function persistBlockOrder(model: BlockModel, ids: string[]): Promise<void> {
  const writer = ORDER_WRITERS[model];
  await writer(ids.map((id, index) => ({ id, order: index + 1 })));
}

export interface BlockItemPayload {
  model: string;
  id?: string | null;
  data?: Record<string, unknown>;
}

export async function saveBlockItem(input: BlockItemPayload): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  if (!isBlockModel(input.model)) {
    return { ok: false, message: "نوع الكتلة غير معروف." };
  }
  const model = input.model;
  const raw = input.data ?? {};
  const parsed = blockSchemas[model].safeParse({ ...raw, id: raw.id ?? input.id ?? undefined });
  if (!parsed.success) {
    return { ok: false, message: "تحقّق من الحقول المعلّمة.", errors: fieldErrors(parsed.error) };
  }

  const v = parsed.data as Record<string, unknown>;
  const id = typeof v.id === "string" && v.id ? v.id : null;
  const order = typeof v.order === "number" ? v.order : undefined;
  const isActive = typeof v.isActive === "boolean" ? v.isActive : true;
  const ip = await currentIp();
  let summary = "";

  try {
    switch (model) {
      case "TrustItem": {
        const title = sanitizeText(String(v.title ?? ""), 200);
        const data = {
          title,
          description: blankToNull(sanitizeText(String(v.description ?? ""), 1000)),
          icon: blankToNull(String(v.icon ?? "")) || ICON_BLOCK_DEFAULTS.TrustItem,
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.trustItem.update({ where: { id }, data })
          : await prisma.trustItem.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} عنصر شريط الثقة «${title}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "TrustItem", entityId: row.id, summary, ip });
        break;
      }
      case "ProcessStep": {
        const title = sanitizeText(String(v.title ?? ""), 200);
        const data = {
          title,
          description: sanitizeText(String(v.description ?? ""), 2000),
          icon: blankToNull(String(v.icon ?? "")) || ICON_BLOCK_DEFAULTS.ProcessStep,
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.processStep.update({ where: { id }, data })
          : await prisma.processStep.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} خطوة المنهجية «${title}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "ProcessStep", entityId: row.id, summary, ip });
        break;
      }
      case "ValueItem": {
        const title = sanitizeText(String(v.title ?? ""), 200);
        const data = {
          title,
          description: sanitizeText(String(v.description ?? ""), 2000),
          icon: blankToNull(String(v.icon ?? "")) || ICON_BLOCK_DEFAULTS.ValueItem,
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.valueItem.update({ where: { id }, data })
          : await prisma.valueItem.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} قيمة «${title}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "ValueItem", entityId: row.id, summary, ip });
        break;
      }
      case "WhyItem": {
        const title = sanitizeText(String(v.title ?? ""), 200);
        const data = {
          title,
          description: sanitizeText(String(v.description ?? ""), 2000),
          icon: blankToNull(String(v.icon ?? "")) || ICON_BLOCK_DEFAULTS.WhyItem,
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.whyItem.update({ where: { id }, data })
          : await prisma.whyItem.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} سبب «${title}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "WhyItem", entityId: row.id, summary, ip });
        break;
      }
      case "Statistic": {
        const label = sanitizeText(String(v.label ?? ""), 120);
        const data = {
          label,
          value: sanitizeText(String(v.value ?? ""), 40),
          prefix: blankToNull(sanitizeText(String(v.prefix ?? ""), 10)),
          suffix: blankToNull(sanitizeText(String(v.suffix ?? ""), 10)),
          icon: blankToNull(String(v.icon ?? "")),
          isHighlight: v.isHighlight === true,
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.statistic.update({ where: { id }, data })
          : await prisma.statistic.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} إحصائية «${label}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "Statistic", entityId: row.id, summary, ip });
        break;
      }
      case "Testimonial": {
        const quote = sanitizeText(String(v.quote ?? ""), 1500);
        const isAnonymous = v.isAnonymous !== false;
        const data = {
          quote,
          authorName: blankToNull(sanitizeText(String(v.authorName ?? ""), 120)),
          authorRole: blankToNull(sanitizeText(String(v.authorRole ?? ""), 120)),
          rating: typeof v.rating === "number" ? v.rating : 5,
          isAnonymous,
          image: blankToNull(String(v.image ?? "")),
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id
          ? await prisma.testimonial.update({ where: { id }, data })
          : await prisma.testimonial.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} رأي مستفيد`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "Testimonial", entityId: row.id, summary, ip });
        break;
      }
      case "Faq": {
        const question = sanitizeText(String(v.question ?? ""), 300);
        const data = {
          question,
          answer: sanitizeText(String(v.answer ?? ""), 3000),
          category: sanitizeText(String(v.category ?? ""), 80) || "عام",
          isActive,
          ...(order === undefined ? {} : { order }),
        };
        const row = id ? await prisma.faq.update({ where: { id }, data }) : await prisma.faq.create({ data });
        summary = `${id ? "تعديل" : "إضافة"} سؤال شائع «${question}»`;
        await logActivity({ userId: user.id, userName: user.name, action: id ? "UPDATE" : "CREATE", entity: "Faq", entityId: row.id, summary, ip });
        break;
      }
    }
  } catch {
    return { ok: false, message: "تعذّر حفظ العنصر." };
  }

  revalidateContentPaths();
  return { ok: true, message: id ? "تم حفظ التعديلات." : "تمت الإضافة بنجاح." };
}

export async function deleteBlockItem(input: {
  model: string;
  id: string;
}): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  if (!isBlockModel(input.model)) {
    return { ok: false, message: "نوع الكتلة غير معروف." };
  }
  const model = input.model;
  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, message: "معرّف العنصر مفقود." };

  try {
    switch (model) {
      case "TrustItem":
        await prisma.trustItem.delete({ where: { id } });
        break;
      case "ProcessStep":
        await prisma.processStep.delete({ where: { id } });
        break;
      case "ValueItem":
        await prisma.valueItem.delete({ where: { id } });
        break;
      case "WhyItem":
        await prisma.whyItem.delete({ where: { id } });
        break;
      case "Statistic":
        await prisma.statistic.delete({ where: { id } });
        break;
      case "Testimonial":
        await prisma.testimonial.delete({ where: { id } });
        break;
      case "Faq":
        await prisma.faq.delete({ where: { id } });
        break;
    }
  } catch {
    return { ok: false, message: "تعذّر حذف العنصر." };
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: model,
    entityId: id,
    summary: `حذف عنصر من ${model}`,
    ip: await currentIp(),
  });

  revalidateContentPaths();
  return { ok: true, message: "تم الحذف." };
}

export async function reorderBlockItems(input: {
  model: string;
  ids?: string[];
  id?: string;
  direction?: "up" | "down";
}): Promise<ContentActionResult> {
  const { user } = await getAuthContext();
  if (!user) return DENIED;
  if (!can(user.role, "content.edit")) return FORBIDDEN;

  if (!isBlockModel(input.model)) {
    return { ok: false, message: "نوع الكتلة غير معروف." };
  }
  const model = input.model;

  const rows = await ORDER_READERS[model]();
  const ordered = rows.map((row) => row.id);

  if (Array.isArray(input.ids) && input.ids.length) {
    const known = new Set(ordered);
    const requested = input.ids.filter((id) => known.has(id));
    for (const id of ordered) {
      if (!requested.includes(id)) requested.push(id);
    }
    await persistBlockOrder(model, requested);
  } else if (input.id && (input.direction === "up" || input.direction === "down")) {
    const index = ordered.indexOf(input.id);
    const target = input.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return { ok: false, message: "لا يوجد عنصر في هذا الاتجاه." };
    }
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    await persistBlockOrder(model, next);
  } else {
    return { ok: false, message: "طلب الترتيب غير صالح." };
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: model,
    entityId: input.id ?? null,
    summary: `إعادة ترتيب ${model}`,
    ip: await currentIp(),
  });

  revalidateContentPaths();
  return { ok: true, message: "تم تحديث الترتيب." };
}
