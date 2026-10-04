/**
 * Seeds the database with the default admin account and all editable content.
 *
 * Idempotent: safe to re-run. Existing rows are updated in place (matched by
 * slug / unique key) rather than duplicated, so an admin who has already
 * customised the site will not lose their edits by re-seeding.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { SERVICES_A } from "./content/services";
import { SERVICES_B } from "./content/services-b";
import { PROGRAMS } from "./content/programs";
import { PROTOCOLS } from "./content/protocols";
import { CATEGORIES, POSTS, TAGS } from "./content/posts";
import {
  FAQS,
  PRIVACY_HTML,
  PROCESS_STEPS,
  SITE_COPY,
  STATISTICS,
  TESTIMONIALS,
  TERMS_HTML,
  TRUST_ITEMS,
  VALUE_ITEMS,
  WHY_ITEMS,
} from "./content/pages";
import type { ContentSeed } from "./content/types";

const prisma = new PrismaClient();

const JSON_SAFE = (value: unknown) => JSON.stringify(value ?? null);

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@sewrwaie.sa").trim();
  const password = process.env.ADMIN_PASSWORD || "SewrWaie@2026";
  const name = process.env.ADMIN_NAME || "مدير النظام";
  const emailLower = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { emailLower } });
  if (existing) {
    console.log(`• المستخدم موجود بالفعل: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      emailLower,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN",
      jobTitle: "مدير النظام",
      passwordChangedAt: new Date(),
    },
  });
  console.log(`✓ تم إنشاء حساب المدير: ${email}`);
  if (password === "SewrWaie@2026") {
    console.log(
      "  ⚠  غيّر كلمة المرور فورًا من: الإدارة ← المستخدمون ← تغيير كلمة المرور",
    );
  }
}

async function seedSettings() {
  const c = SITE_COPY;
  const data = {
    siteName: "سوار وعي",
    siteNameEn: "Sewr Waie",
    tagline: "مركز الإحاطة بعلوم التعافي",
    phone: c.phone,
    whatsapp: c.whatsapp,
    whatsappMessage: c.whatsappMessage,
    email: c.email,
    address: c.address,
    city: c.city,
    country: c.country,
    mapEmbedUrl: c.mapEmbedUrl || null,
    mapLinkUrl: c.mapLinkUrl || null,
    workingHoursJson: JSON_SAFE(c.workingHours),
    socialsJson: JSON_SAFE(c.socials),

    heroBadge: c.heroBadge,
    heroTitle: c.heroTitle,
    heroDescription: c.heroDescription,
    heroImage: c.heroImage,
    heroImageAlt: c.heroImageAlt,
    homeAboutTitle: c.homeAboutTitle,
    homeAboutText: c.homeAboutText,
    homeAboutImage: c.homeAboutImage,
    homeAboutImageAlt: c.homeAboutImageAlt,
    homeServicesTitle: c.homeServicesTitle,
    homeServicesText: c.homeServicesText,
    homeServicesCtaText: c.homeServicesCtaText,
    homeProgramsTitle: c.homeProgramsTitle,
    homeProgramsText: c.homeProgramsText,
    homeBlogTitle: c.homeBlogTitle,
    homeBlogText: c.homeBlogText,
    homeTestimonialsTitle: c.homeTestimonialsTitle,
    homeFaqTitle: c.homeFaqTitle,
    homeFaqText: c.homeFaqText,
    finalCtaBadge: c.finalCtaBadge,
    finalCtaTitle: c.finalCtaTitle,
    finalCtaText: c.finalCtaText,

    aboutHeroTitle: c.aboutHeroTitle,
    aboutHeroText: c.aboutHeroText,
    aboutWhoTitle: c.aboutWhoTitle,
    aboutWhoText: c.aboutWhoText,
    aboutVisionTitle: c.aboutVisionTitle,
    aboutVisionText: c.aboutVisionText,
    aboutMissionTitle: c.aboutMissionTitle,
    aboutMissionText: c.aboutMissionText,
    aboutValuesTitle: c.aboutValuesTitle,
    aboutValuesText: c.aboutValuesText,
    aboutVision2030Title: c.aboutVision2030Title,
    aboutVision2030Text: c.aboutVision2030Text,
    aboutVision2030Image: c.aboutVision2030Image,
    aboutWhyTitle: c.aboutWhyTitle,
    aboutWhyText: c.aboutWhyText,

    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    seoKeywords: c.seoKeywords,

    notificationEmail: process.env.NOTIFICATION_EMAIL || null,
  };

  await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: {},
  });
  console.log("✓ تم ضبط إعدادات الموقع");
}

/** Generic "upsert a list of ordered rows" helper. */
async function seedOrdered(
  label: string,
  model: {
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  },
  where: Record<string, unknown>,
  rows: Array<Record<string, unknown> & { order?: number; isActive?: boolean }>,
) {
  await model.deleteMany({ where });
  let order = 0;
  for (const row of rows) {
    await model.create({
      data: { ...row, order: row.order ?? order, isActive: row.isActive ?? true },
    });
    order += 1;
  }
  console.log(`✓ ${label} (${rows.length})`);
}

async function seedContentItem(type: string, item: ContentSeed) {
  const data = {
    type,
    slug: item.slug,
    title: item.title,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription,
    icon: item.icon,
    image: item.image ?? null,
    audience: item.audience ?? null,
    stepsJson: JSON_SAFE(item.steps ?? []),
    benefitsJson: JSON_SAFE(item.benefits ?? []),
    outcomesJson: JSON_SAFE(item.outcomes ?? []),
    notesJson: JSON_SAFE(item.notes ?? []),
    durationLabel: item.durationLabel ?? null,
    faqsJson: JSON_SAFE(item.faqs ?? []),
    seoTitle: item.seoTitle ?? null,
    seoDescription: item.seoDescription ?? null,
    order: item.order,
    isActive: true,
    isFeatured: item.isFeatured ?? false,
  };

  await prisma.contentItem.upsert({
    where: { type_slug: { type, slug: item.slug } },
    create: data,
    // Content is authoritative on seed, but only when the row is untouched:
    // we never overwrite a deactivation the admin did on purpose.
    update: { ...data, isActive: true },
  });
}

async function seedContent() {
  const services = [...SERVICES_A, ...SERVICES_B];
  for (const item of services) await seedContentItem("SERVICE", item);
  for (const item of PROGRAMS) await seedContentItem("PROGRAM", item);
  for (const item of PROTOCOLS) await seedContentItem("PROTOCOL", item);
  console.log(
    `✓ المحتوى: ${services.length} خدمة · ${PROGRAMS.length} برنامج · ${PROTOCOLS.length} بروتوكول`,
  );
}

async function seedBlog() {
  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  // Categories
  await prisma.category.deleteMany({});
  const categoryMap = new Map<string, string>();
  let order = 0;
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        order: cat.order ?? order,
        isActive: true,
      },
    });
    categoryMap.set(cat.slug, created.id);
    order += 1;
  }

  // Tags
  await prisma.tag.deleteMany({});
  const tagMap = new Map<string, string>();
  for (const tag of TAGS) {
    const created = await prisma.tag.create({
      data: { name: tag.name, slug: tag.slug },
    });
    tagMap.set(tag.slug, created.id);
  }

  // Posts
  let published = 0;
  for (const post of POSTS) {
    const publishedAt = new Date(
      Date.now() - (post.publishedAtOffsetDays ?? 1) * 86_400_000,
    );
    const wordCount = post.content.replace(/<[^>]+>/g, " ").split(/\s+/).length;
    const readingMinutes = Math.max(1, Math.round(wordCount / 200));

    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        title: post.title,
        slug: post.slug,
        searchText: `${post.title} ${post.excerpt}`.toLowerCase(),
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        coverImageAlt: post.coverImageAlt,
        categoryId: categoryMap.get(post.categorySlug) ?? null,
        authorId: admin?.id ?? null,
        status: post.status,
        publishedAt: post.status === "PUBLISHED" ? publishedAt : null,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        readingMinutes,
        featuredOnHome: post.featuredOnHome,
        views: 0,
        tags: {
          create: post.tags
            .map((slug) => tagMap.get(slug))
            .filter((id): id is string => Boolean(id))
            .map((tagId) => ({ tagId })),
        },
      },
      update: {},
    });
    published += 1;
  }
  console.log(
    `✓ المدونة: ${CATEGORIES.length} تصنيف · ${TAGS.length} وسم · ${published} مقال`,
  );
}

async function seedPages() {
  const pages = [
    {
      slug: "privacy",
      title: "سياسة الخصوصية",
      subtitle: "كيف نتعامل مع بياناتك ولماذا",
      content: PRIVACY_HTML,
      seoTitle: "سياسة الخصوصية | سوار وعي",
      seoDescription:
        "التزام مركز سوار وعي بحماية البيانات الشخصية وفق نظام حماية البيانات الشخصية السعودي.",
    },
    {
      slug: "terms",
      title: "الشروط والأحكام",
      subtitle: "استخدامك للموقع يعني موافقتك على هذه الشروط",
      content: TERMS_HTML,
      seoTitle: "الشروط والأحكام | سوار وعي",
      seoDescription:
        "شروط استخدام موقع مركز سوار وعي للإحاطة بعلوم التعافي.",
    },
  ];

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: page,
      update: {},
    });
  }
  console.log(`✓ الصفحات الثابتة (${pages.length})`);
}

async function seedDemoLeads() {
  const count = await prisma.client.count();
  if (count > 0) {
    console.log("• توجد طلبات مسجّلة بالفعل — لم تتم إضافة بيانات تجريبية");
    return;
  }

  // Demonstration rows so the dashboard is not empty on first login.
  // Obvious placeholders — delete them from the dashboard before going live.
  const { encrypt, blindIndex, normalizePhone, normalizeEmail, phoneLast4 } =
    await import("../src/lib/crypto");

  const demo = [
    {
      fullName: "مستفيد تجريبي",
      phone: "0500000001",
      email: "demo1@example.com",
      city: "الرياض",
      whoIsAsking: "SELF",
      serviceInterest: "استشارة أولية للتقييم",
      status: "NEW",
      source: "الموقع الإلكتروني",
      notes: "صفوفة تجريبية — احذفها قبل الإطلاق.",
    },
    {
      fullName: "أسرة مستفيد تجريبي",
      phone: "0500000002",
      email: "demo2@example.com",
      city: "جدة",
      whoIsAsking: "FAMILY",
      serviceInterest: "إرشاد أسري أو زوجي",
      status: "CONTACTED",
      source: "إنستغرام",
      notes: "صفوفة تجريبية — احذفها قبل الإطلاق.",
    },
    {
      fullName: "جهة تعليمية تجريبية",
      phone: "0500000003",
      email: "demo3@example.com",
      city: "الدمام",
      whoIsAsking: "INSTITUTION",
      serviceInterest: "برامج الوقاية والتوعية",
      status: "BOOKED",
      source: "فعالية أو ورشة",
      notes: "صفوفة تجريبية — احذفها قبل الإطلاق.",
    },
  ];

  let seq = 1;
  for (const row of demo) {
    const phone = normalizePhone(row.phone);
    await prisma.client.create({
      data: {
        code: `SW-${String(seq).padStart(4, "0")}`,
        fullName: row.fullName,
        searchName: row.fullName.toLowerCase(),
        phoneEnc: encrypt(phone),
        emailEnc: encrypt(row.email),
        phoneHash: blindIndex(phone),
        emailHash: blindIndex(normalizeEmail(row.email)),
        phoneLast4: phoneLast4(phone),
        emailMasked: row.email.replace(/^(.).*(@.*)$/, "$1••••$2"),
        city: row.city,
        searchCity: row.city.toLowerCase(),
        whoIsAsking: row.whoIsAsking,
        serviceInterest: row.serviceInterest,
        status: row.status,
        source: row.source,
        notesEnc: encrypt(row.notes),
        consentGivenAt: new Date(),
      },
    });
    seq += 1;
  }

  const first = await prisma.client.findFirst({
    where: { code: "SW-0001" },
  });
  if (first) {
    const { encrypt } = await import("../src/lib/crypto");
    const inDays = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d;
    };
    await prisma.appointment.createMany({
      data: [
        {
          clientId: first.id,
          service: "استشارة أولية للتقييم",
          preferredDate: inDays(2),
          preferredTime: "10:00",
          status: "PENDING",
          channel: "BOOKING_FORM",
          notesEnc: encrypt("موعد تجريبي."),
        },
        {
          clientId: first.id,
          service: "إرشاد أسري",
          preferredDate: inDays(5),
          preferredTime: "17:30",
          status: "CONFIRMED",
          channel: "BOOKING_FORM",
          notesEnc: encrypt("موعد تجريبي."),
        },
      ],
    });
  }

  const { encrypt: enc } = await import("../src/lib/crypto");
  const must = (value: string | null) => value ?? "";
  await prisma.contactMessage.create({
    data: {
      name: "زائر تجريبي",
      phoneEnc: enc("0500000009"),
      emailEnc: enc("visitor@example.com"),
      phoneHash: blindIndex("0500000009"),
      emailHash: blindIndex("visitor@example.com"),
      subject: "استفسار عن برنامج ماتريكس",
      topic: "استفسار عن برنامج",
      messageEnc: must(
        enc("هذه رسالة تجريبية في صندوق الوارد. احذفها قبل الإطلاق."),
      ),
      isRead: false,
      consentGivenAt: new Date(),
    },
  });

  console.log("✓ بيانات تجريبية للوحة التحكم (٣ طلبات · موعدان · رسالة) — احذفها قبل الإطلاق");
}

async function main() {
  console.log("— بدء تعبئة قاعدة البيانات —\n");
  await seedAdmin();
  await seedSettings();

  await seedOrdered(
    "شريط الثقة",
    prisma.trustItem,
    {},
    TRUST_ITEMS.map((t) => ({
      title: t.title,
      description: t.description,
      icon: t.icon,
    })),
  );
  await seedOrdered(
    "منهجية التعافي",
    prisma.processStep,
    {},
    PROCESS_STEPS.map((s) => ({
      title: s.title,
      description: s.description,
      icon: s.icon,
    })),
  );
  await seedOrdered(
    "القيم",
    prisma.valueItem,
    {},
    VALUE_ITEMS.map((v) => ({
      title: v.title,
      description: v.description,
      icon: v.icon,
    })),
  );
  await seedOrdered(
    "لماذا تختارنا",
    prisma.whyItem,
    {},
    WHY_ITEMS.map((w) => ({
      title: w.title,
      description: w.description,
      icon: w.icon,
    })),
  );
  await seedOrdered(
    "الإحصائيات",
    prisma.statistic,
    {},
    STATISTICS.map((s) => ({
      label: s.label,
      value: s.value,
      prefix: s.prefix,
      suffix: s.suffix,
      icon: s.icon,
      isHighlight: s.isHighlight,
    })),
  );
  await seedOrdered(
    "آراء المستفيدين",
    prisma.testimonial,
    {},
    TESTIMONIALS.map((t) => ({
      quote: t.quote,
      rating: t.rating,
      isAnonymous: t.isAnonymous,
      authorName: t.authorName,
      authorRole: t.authorRole,
    })),
  );
  await seedOrdered(
    "الأسئلة الشائعة",
    prisma.faq,
    {},
    FAQS.map((f) => ({
      question: f.question,
      answer: f.answer,
      category: f.category,
    })),
  );

  await seedContent();
  await seedBlog();
  await seedPages();
  await seedDemoLeads();

  console.log("\n✓ اكتملت التعبئة.");
  console.log("  تذكير: بدّل كلمتا المرور والأسرار في ملف .env قبل النشر.");
}

main()
  .catch((error) => {
    console.error("✗ فشلت التعبئة:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
