/**
 * Adds the items from the operator's own brief that were missing.
 *
 * The brief (a .docx the operator sent) restates the centre's identity,
 * services, programmes and protocols. An audit of every line against the
 * database found almost all of it already present — in fuller wording than the
 * brief uses. This script therefore adds only the four things genuinely
 * absent, and changes nothing that is already there.
 *
 *   1. Two values: الصدق والشفافية, الأمانة والإخلاص. No existing value
 *      covered honesty or integrity.
 *   2. One sentence appended to الاحترافية, carrying the brief's phrase
 *      "متسحين بالعلوم والمعارف المنهجية". The existing sentence is kept.
 *   3. One sentence appended to aboutWhoText, naming the educational and
 *      rehabilitative institutions the brief lists as an audience.
 *
 * Every write is guarded by a presence check, so running this twice is a no-op
 * and it can never append the same sentence twice.
 *
 * Run: npx tsx scripts/apply-brief-additions.ts [--dry]
 */
export {};

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

/** The brief lists these two values; neither existed. */
const NEW_VALUES = [
  {
    title: "الصدق والشفافية",
    description: "ننتهج الصدق والشفافية في التعامل مع مستفيدينا بمختلف فئاتهم وغاياتهم.",
    icon: "Scale",
  },
  {
    title: "الأمانة والإخلاص",
    description: "نؤدي أدوارنا بأمانة وإخلاص.",
    icon: "Handshake",
  },
];

/** Appended to the الاحترافية value, which already carries the first half. */
const PROFESSIONAL_ADDITION =
  "نسعى متسلحين بالعلوم والمعارف المنهجية لبلوغ غاياتنا.";

/** Appended to the who-we-are paragraph. */
const AUDIENCE_ADDITION =
  "يد تمتد إلى المدمنيين الراغبين في التعافي، وإلى أسرهم، وإلى المؤسسات التعليمية والتأهيلية؛ تثقيفًا وتعريفًا بأحدث النظم والبرامج التي تساعد في نشر الوعي والثقافة والمعرفة العلمية لبلوغ الأهداف.";

/**
 * Compares on a normalised form so a sentence counts as present regardless of
 * tashkeel, hamza form, or punctuation the operator may have typed.
 */
function contains(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/[\u064B-\u0652\u0640]/g, "")
      .replace(/[\u0623\u0625\u0622\u0671]/g, (c) =>
        ({ "\u0623": "ا", "\u0625": "ا", "\u0622": "ا", "\u0671": "ى" })[c]!,
      )
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return norm(haystack).includes(norm(needle));
}

let applied = 0;
let skipped = 0;

async function main() {
  console.log(
    `\n— إضافة بنود الملف الناقصة ${DRY ? "(معاينة فقط)" : ""} —\n`,
  );

  // ── 1 + 2. Values ───────────────────────────────────────────────────
  const existing = await prisma.valueItem.findMany({ orderBy: { order: "asc" } });
  console.log(`  القيم الحالية: ${existing.length}`);

  let nextOrder = existing.length ? Math.max(...existing.map((v) => v.order)) + 1 : 0;

  for (const value of NEW_VALUES) {
    const dupe = existing.find((v) => v.title === value.title);
    if (dupe) {
      console.log(`  · موجودة أصلًا: ${value.title}`);
      skipped += 1;
      continue;
    }

    const data = { ...value, order: nextOrder };
    if (DRY) {
      console.log(`  [معاينة] قيمة جديدة: ${value.title}`);
    } else {
      await prisma.valueItem.create({ data });
      console.log(`  ✓ أُضيفت قيمة: ${value.title}`);
    }
    applied += 1;
    nextOrder += 1;
  }

  // The professionalism value exists; extend it rather than adding a second one
  // that would say the same thing.
  const professional = existing.find((v) => v.title === "الاحترافية");
  if (!professional) {
    console.log("  ! لم أجد قيمة «الاحترافية» — تُركت كما هي");
    skipped += 1;
  } else if (contains(professional.description, PROFESSIONAL_ADDITION)) {
    console.log("  · جملة «المعارف المنهجية» موجودة أصلًا");
    skipped += 1;
  } else {
    const next = `${professional.description} ${PROFESSIONAL_ADDITION}`;
    if (DRY) {
      console.log("  [معاينة] إضافة جملة إلى «الاحترافية»");
    } else {
      await prisma.valueItem.update({
        where: { id: professional.id },
        data: { description: next },
      });
      console.log("  ✓ أُضيفت جملة «المعارف المنهجية» إلى «الاحترافية»");
    }
    applied += 1;
  }

  // ── 3. Who we are ───────────────────────────────────────────────────
  const settings = await prisma.siteSetting.findFirst();
  if (!settings) {
    console.log("  ! لا يوجد صف إعدادات");
  } else if (contains(settings.aboutWhoText ?? "", AUDIENCE_ADDITION)) {
    console.log("  · جملة «الجامعات والمؤسسات التعليمية» موجودة أصلًا");
    skipped += 1;
  } else {
    const next = `${settings.aboutWhoText ?? ""}\n\n${AUDIENCE_ADDITION}`;
    if (DRY) {
      console.log("  [معاينة] إضافة جملة الفئات إلى «من نحن»");
    } else {
      await prisma.siteSetting.update({
        where: { id: settings.id },
        data: { aboutWhoText: next },
      });
      console.log("  ✓ أُضيفت جملة الفئات المستهدفة إلى «من نحن»");
    }
    applied += 1;
  }

  console.log(`\n  طُبّق ${applied} · تُخطّى ${skipped}\n`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\n✗ فشل التطبيق:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});