/** Prints a row-count summary of the seeded database. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODELS = [
  "user", "client", "appointment", "contactMessage", "contentItem", "post",
  "category", "tag", "faq", "testimonial", "statistic", "trustItem",
  "processStep", "valueItem", "whyItem", "page", "siteSetting", "activityLog",
];

const LABELS: Record<string, string> = {
  user: "مستخدمو اللوحة",
  client: "طلبات المستفيدين",
  appointment: "المواعيد",
  contactMessage: "الرسائل",
  contentItem: "الخدمات/البرامج/البروتوكولات",
  post: "مقالات المدونة",
  category: "تصنيفات المدونة",
  tag: "وسوم المدونة",
  faq: "الأسئلة الشائعة",
  testimonial: "آراء المستفيدين",
  statistic: "الإحصائيات",
  trustItem: "شريط الثقة",
  processStep: "منهجية التعافي",
  valueItem: "القيم",
  whyItem: "لماذا تختارنا",
  page: "الصفحات الثابتة",
  siteSetting: "إعدادات الموقع",
  activityLog: "سجل النشاط",
};

async function main() {
  const rows: Array<[string, number]> = [];
  for (const model of MODELS) {
    rows.push([LABELS[model] ?? model, await prisma[model as "user"].count()]);
  }

  const content = await prisma.contentItem.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  for (const group of content) {
    rows.push([`  └ ${group.type}`, group._count._all]);
  }

  const width = Math.max(...rows.map((r) => r[0].length));
  console.log("\n" + "─".repeat(width + 12));
  console.log("  " + "الجدول".padEnd(width) + "   الصفوف");
  console.log("─".repeat(width + 12));
  for (const [label, count] of rows) {
    console.log("  " + label.padEnd(width) + "   " + String(count).padStart(5));
  }
  console.log("─".repeat(width + 12) + "\n");
}

main().finally(async () => {
  await prisma.$disconnect();
});
