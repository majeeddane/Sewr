/**
 * Inspects the most recent contact message to prove the sensitive columns are
 * stored encrypted, then removes the test row.
 *
 * Run: npx tsx scripts/verify-encryption.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.contactMessage.findFirst({
    where: { subject: "اختبار من المتصفح" },
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    console.log("✗ لم يُعثر على الرسالة — النموذج لم يحفظ شيئًا");
    process.exitCode = 1;
    return;
  }

  const checks: Array<[string, boolean]> = [
    ["الاسم محفوظ", row.name === "مستفيد اختبار المتصفح"],
    ["رقم الجوال مشفّر", Boolean(row.phoneEnc) && !row.phoneEnc!.includes("0512345678")],
    ["نص الرسالة مشفّر", Boolean(row.messageEnc) && !row.messageEnc!.includes("اختبار")],
    ["البريد مشفّر", Boolean(row.emailEnc) && !row.emailEnc!.includes("browser-test")],
    ["فهرس البحث موجود", Boolean(row.phoneHash) && Boolean(row.emailHash)],
    ["موافقة الخصوصية محفوظة", Boolean(row.consentGivenAt)],
    ["عنوان IP محفوظ", Boolean(row.ip)],
    ["الرسالة جديدة", row.isRead === false],
  ];

  console.log("— تحقق من تشفير بيانات النموذج —\n");
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failed += 1;
  }

  console.log(`\n  cipher sample: ${row.messageEnc?.slice(0, 40)}…`);
  console.log(`  blind index  : ${row.phoneHash?.slice(0, 24)}…`);

  // Clean up so the dashboard is not polluted with test data.
  await prisma.contactMessage.delete({ where: { id: row.id } });
  console.log("\n✓ حُذفت رسالة الاختبار");

  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error("✗ فشل التحقق:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
