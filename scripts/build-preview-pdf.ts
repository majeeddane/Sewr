/**
 * Builds the client preview PDF from the captured screenshots.
 *
 * Output is a self-contained HTML file that Chrome prints to PDF. Written to an
 * ASCII directory because headless Chrome cannot save into a path containing
 * Arabic characters.
 *
 * Usage:  npx tsx scripts/build-preview-pdf.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHOTS = join(tmpdir(), "sewr-preview");
const WORK = join(tmpdir(), "sewr-deck");
const OUT_PDF = process.argv[2] ?? join(tmpdir(), "sewr-deck", "Sewr-Waie.pdf");

/** Pages shown to the client, in reading order. */
const SECTIONS: Array<{ title: string; note: string; shots: string[] }> = [
  {
    title: "الصفحة الرئيسية",
    note: "صورة خلفية ممتدة، شريط ثقة، نبذة، الخدمات، منهجية التعافي، آراء المستفيدين، وأسئلة شائعة.",
    shots: ["01-home"],
  },
  {
    title: "من نحن",
    note: "الرؤية والرسالة والقيم، وارتباط المركز برؤية المملكة ٢٠٣٠، وأسباب اختيار المركز.",
    shots: ["02-about"],
  },
  {
    title: "الخدمات",
    note: "تسع خدمات تغطي التأهيل والإرشاد ودعم الأسرة.",
    shots: ["03-services", "09-service-detail"],
  },
  {
    title: "البرامج العلاجية",
    note: "تسعة برامج متخصصة، من مراحل المرافقة الأولى إلى البرامج التخصصية.",
    shots: ["04-programs", "10-program-detail"],
  },
  {
    title: "البروتوكولات العلاجية",
    note: "خمسة بروتوكولات مبنية على الأدلة، مع الخطوات ومخرجات كل بروتوكول.",
    shots: ["05-protocols"],
  },
  {
    title: "المدونة",
    note: "مقالات توعوية عن اضطراب الإدمان والتعافي ودور الأسرة، مع تصنيفات ووسوم وبحث.",
    shots: ["06-blog", "11-article"],
  },
  {
    title: "نماذج التواصل والحجز",
    note: "نموذج تواصل ونموذج حجز استشارة، كلاهما يحفظ في لوحة التحكم  ويرسل بريدًا للإدارة.",
    shots: ["07-contact", "08-book"],
  },
  {
    title: "الخصوصية وحماية البيانات",
    note: "صفحة مستقلة تشرح 如何 تُعالَج البيانات وفق نظام حماية البيانات الشخصية.",
    shots: ["12-privacy"],
  },
  {
    title: "لوحة التحكم — نظرة عامة",
    note: "ملخّص لحظي: طلبات جديدة، مواعيد الأسبوع، رسائل غير مقروءة، ومؤشرات الأداء.",
    shots: ["20-admin-overview"],
  },
  {
    title: "لوحة التحكم — المستفيدون والمواعيد",
    note: "سجلّ كامل للمستفيدين مع البحث والتصفية، وجدول المواعيد بحالاتها. البيانات الحساسة مشفّرة في قاعدة البيانات.",
    shots: ["21-admin-clients", "22-admin-appointments"],
  },
  {
    title: "لوحة التحكم — إدارة المحتوى",
    note: "تحرير الخدمات والبرامج والبروتوكولات والمقالات بمحرّر نصوص، مع جدولة النشر.",
    shots: ["23-admin-content", "24-admin-posts"],
  },
  {
    title: "لوحة التحكم — التحكم بكل صور الموقع",
    note: "صفحة الصور: تغيير أي صورة أو إخفاؤها أو إزالتها من مكان واحد، مع معاينة فورية.",
    shots: ["25-admin-images", "26-admin-media"],
  },
  {
    title: "لوحة التحكم — الإعدادات وسجل النشاط",
    note: "إعدادات الموقع والألوان وبيانات التواصل، مع سجل يوثّق كل تعديل جرى من أي مستخدم.",
    shots: ["27-admin-settings", "28-admin-activity"],
  },
];

function readShot(name: string): string | null {
  const file = join(SHOTS, `${name}.png`);
  if (!existsSync(file)) return null;
  const buffer = readFileSync(file);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(): string {
  const missing: string[] = [];

  const cover = readShot("01-home");

  const body = SECTIONS.map((section) => {
    const frames = section.shots
      .map((name) => {
        const data = readShot(name);
        if (!data) {
          missing.push(name);
          return "";
        }
        return `<figure class="shot"><img src="${data}" alt="" /></figure>`;
      })
      .join("");

    return `
      <section class="page">
        <header class="head">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.note)}</p>
        </header>
        ${frames}
      </section>`;
  }).join("");

  const used = new Set(SECTIONS.flatMap((s) => s.shots));
  const orphans = readdirSync(SHOTS)
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.replace(/\.png$/, ""))
    .filter((name) => !used.has(name));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>مركز سوار وعي — عرض تقديمي</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Segoe UI", "Tahoma", "Arial", sans-serif;
    background: #fff;
    color: #1c1430;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .cover {
    height: 247mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0 12mm;
    page-break-after: always;
    background: linear-gradient(160deg, #4B2A7B 0%, #3a1f60 55%, #24123f 100%);
    color: #fff;
  }
  .cover .brand {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin: 0 0 6px;
  }
  .cover .latin {
    font-size: 17px;
    letter-spacing: 5px;
    color: #D9A441;
    margin: 0 0 26px;
    direction: ltr;
  }
  .cover .tagline {
    font-size: 17px;
    line-height: 1.9;
    max-width: 120mm;
    color: #e7dcf5;
    margin: 0 0 34px;
  }
  .cover .badge {
    display: inline-block;
    border: 1px solid rgba(217,164,65,0.55);
    color: #E7C88A;
    border-radius: 999px;
    padding: 7px 20px;
    font-size: 13px;
    letter-spacing: 1px;
  }
  .cover .meta {
    margin-top: 30px;
    font-size: 12px;
    color: #b9a8d4;
  }

  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .head { margin-bottom: 7mm; }
  .head h2 {
    font-size: 21px;
    font-weight: 800;
    color: #4B2A7B;
    margin: 0 0 5px;
    padding-bottom: 5px;
    border-bottom: 2px solid #D9A441;
  }
  .head p {
    font-size: 12.5px;
    line-height: 1.85;
    color: #5a5470;
    margin: 0;
  }

  .shot {
    margin: 0 0 6mm;
    border: 1px solid #e3dced;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 3px 14px rgba(40, 20, 70, 0.09);
    background: #faf8fd;
  }
  .shot img { display: block; width: 100%; }

  .two { display: flex; gap: 5mm; }
  .two .shot { flex: 1 1 0; margin-bottom: 0; }
  .two .shot img { height: 108mm; object-fit: cover; object-position: top center; }
</style>
</head>
<body>

<div class="cover">
  <p class="latin">SEWR WAIE</p>
  <h1 class="brand">سوار وعي</h1>
  <p class="tagline">
    مركز متخصص في علوم الإدمان والاضطرابات النفسية والسلوكية.
    نبدأ بتقييم دقيق، ونصاحب كل مساعٍ بعلمٍ ما، وبشرٍ كيف.
  </p>
  <span class="badge">عرض تقديمي للموقع الإلكتروني</span>
  <p class="meta">يشمل الموقع العام ولوحة التحكم</p>
</div>

${body}

</body>
</html>`;
}

async function main() {
  if (!existsSync(SHOTS)) {
    console.error("\n✗ لا توجد لقطات. شغّل سكربت الالتقاط أولًا.\n");
    process.exit(1);
  }

  mkdirSync(WORK, { recursive: true });

  const html = buildHtml();
  const htmlPath = join(WORK, "deck.html");
  writeFileSync(htmlPath, html, "utf8");

  const shots = readdirSync(SHOTS).filter((f) => f.endsWith(".png")).length;
  const frames = SECTIONS.reduce((n, s) => n + s.shots.length, 0);
  console.log(`\n— تجهيز العرض —\n  الأقسام: ${SECTIONS.length}`);
  console.log(`  اللقطات المضمّنة: ${frames} من ${shots}`);
  console.log(`  الحجم: ${(html.length / 1024 / 1024).toFixed(1)} ميغابايت`);
  console.log(`  HTML: ${htmlPath}\n`);
}

main().catch((error) => {
  console.error("\n✗ فشل:", error);
  process.exitCode = 1;
});
