/**
 * Verifies that the booking form created a beneficiary + appointment with the
 * sensitive columns encrypted, then removes the test rows.
 *
 * Run: npx tsx scripts/verify-booking.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: { fullName: "حاجز اختبار المتصفح" },
    orderBy: { createdAt: "desc" },
    include: { appointments: true },
  });

  if (!client) {
    console.log("✗ لم يُعثر على سجل المستفيد");
    process.exitCode = 1;
    return;
  }

  const appointment = client.appointments[0];

  const checks: Array<[string, boolean]> = [
    ["رقم المرجع صحيح", /^SW-\d{4}$/.test(client.code)],
    ["الجوال مشفّر", Boolean(client.phoneEnc) && !client.phoneEnc!.includes("0598765432")],
    ["البريد مشفّر", Boolean(client.emailEnc) && !client.emailEnc!.includes("book-browser")],
    ["فهرس البحث موجود", Boolean(client.phoneHash)],
    ["آخر ٤ أرقام محفوظة", client.phoneLast4 === "5432"],
    ["الحالة جديدة", client.status === "NEW"],
    ["طريقة التواصل واتساب", client.preferredContactMethod === "WHATSAPP"],
    ["ملاحظات الخصوصية محفوظة", Boolean(client.consentGivenAt)],
    ["تم إنشاء موعد", Boolean(appointment)],
    ["حالة الموعد بانتظار التأكيد", appointment?.status === "PENDING"],
    ["الموعد عبر النموذج", appointment?.channel === "BOOKING_FORM"],
    ["وقت الموعد محفوظ", appointment?.preferredTime === "17:00"],
    [
      "ملاحظات الموعد مشفّرة",
      // Notes are optional: null when left blank, ciphertext otherwise.
      appointment?.notesEnc === null ||
        (Boolean(appointment?.notesEnc) && !appointment!.notesEnc!.includes("اختبار")),
    ],
  ];

  console.log("— تحقق من نموذج الحجز —\n");
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failed += 1;
  }

  console.log(`\n  المرجع        : ${client.code}`);
  console.log(`  الموعد        : ${appointment?.preferredDate.toISOString().slice(0, 10)} ${appointment?.preferredTime}`);

  // Duplicate detection: the same phone must not create a second record.
  const dupes = await prisma.client.count({ where: { phoneHash: client.phoneHash } });
  console.log(`  سجلات بنفس الرقم: ${dupes}`);
  if (dupes !== 1) {
    console.log("  ✗ التكرار غير مانع");
    failed += 1;
  } else {
    console.log("  ✓ لا تكرار في السجلات");
  }

  await prisma.appointment.deleteMany({ where: { clientId: client.id } });
  await prisma.client.delete({ where: { id: client.id } });
  console.log("\n✓ حُذفت بيانات الاختبار");

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
