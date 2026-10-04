"use client";

import * as React from "react";
import {
  Check,
  Eye,
  Lock,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { useAction } from "@/components/admin/use-action";
import { ImagePicker } from "@/components/admin/image-picker";
import { Field, Input, Textarea, Checkbox, SubmitButton } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { ColorDefaultMark, ColorField, ColorWarning } from "@/components/admin/settings/color-field";
import { SocialLinksEditor } from "@/components/admin/settings/social-links-editor";
import {
  WorkingHoursEditor,
  type WorkingHourRow,
} from "@/components/admin/settings/working-hours-editor";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  SEO_DESCRIPTION_LIMIT,
  SETTINGS_TABS,
  type SettingsTabKey,
} from "@/components/admin/settings/constants";
import { resetColors, saveSettings, testNotificationEmail } from "./actions";
import { cn } from "@/lib/utils";

/**
 * Tabbed editor for the `SiteSetting` singleton.
 *
 * Only the active tab is mounted, which keeps the FormData clean (one set of
 * field names) and means each tab is a single, independently saved Server
 * Action call.
 */

export interface SettingsFormProps {
  canEdit: boolean;
  settings: {
    // ── Identity
    siteName: string;
    siteNameEn: string;
    tagline: string;
    logoPath: string | null;
    logoAlt: string | null;
    faviconPath: string | null;
    blockAdminIndex: boolean;
    // ── Contact
    phone: string | null;
    whatsapp: string | null;
    whatsappMessage: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string;
    mapEmbedUrl: string | null;
    mapLinkUrl: string | null;
    hours: WorkingHourRow[];
    socials: Record<string, string>;
    // ── Home
    heroBadge: string | null;
    heroTitle: string | null;
    heroDescription: string | null;
    heroImage: string | null;
    heroImageAlt: string | null;
    homeAboutTitle: string | null;
    homeAboutText: string | null;
    homeAboutImage: string | null;
    homeAboutImageAlt: string | null;
    homeServicesTitle: string | null;
    homeServicesText: string | null;
    homeServicesCtaText: string | null;
    homeProgramsTitle: string | null;
    homeProgramsText: string | null;
    homeBlogTitle: string | null;
    homeBlogText: string | null;
    homeTestimonialsTitle: string | null;
    homeFaqTitle: string | null;
    homeFaqText: string | null;
    finalCtaBadge: string | null;
    finalCtaTitle: string | null;
    finalCtaText: string | null;
    // ── About
    aboutHeroTitle: string | null;
    aboutHeroText: string | null;
    aboutWhoTitle: string | null;
    aboutWhoText: string | null;
    aboutVisionTitle: string | null;
    aboutVisionText: string | null;
    aboutMissionTitle: string | null;
    aboutMissionText: string | null;
    aboutValuesTitle: string | null;
    aboutValuesText: string | null;
    aboutVision2030Title: string | null;
    aboutVision2030Text: string | null;
    aboutVision2030Image: string | null;
    aboutWhyTitle: string | null;
    aboutWhyText: string | null;
    // ── SEO
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    ogImage: string | null;
    analyticsCode: string | null;
    // ── Notifications
    notifyEmailEnabled: boolean;
    notificationEmail: string | null;
    notifyOnNewClient: boolean;
    notifyOnNewMessage: boolean;
    notifyOnNewBooking: boolean;
    // ── Appearance
    primaryColor: string;
    accentColor: string;
  };
}

// ── Small building blocks ────────────────────────────────────

interface TextFieldProps {
  name: string;
  label: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "url" | "email" | "tel";
  dir?: "rtl" | "ltr";
  placeholder?: string;
  disabled?: boolean;
}

function TextField({
  name,
  label,
  defaultValue,
  value,
  onChange,
  hint,
  required,
  multiline,
  rows = 4,
  type = "text",
  dir,
  placeholder,
  disabled,
}: TextFieldProps) {
  const id = `f-${name}`;
  const shared = {
    id,
    name,
    dir,
    placeholder,
    disabled,
  };
  const bound = onChange
    ? {
        value: value ?? "",
        onChange: (
          event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => onChange(event.target.value),
      }
    : { defaultValue: defaultValue ?? "" };

  return (
    <Field label={label} htmlFor={id} hint={hint} required={required}>
      {multiline ? (
        <Textarea {...shared} rows={rows} {...bound} />
      ) : (
        <Input {...shared} type={type} {...bound} />
      )}
    </Field>
  );
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-sand-200 bg-sand-50/70 p-5 dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      <div>
        <h3 className="text-base font-extrabold text-brand-900 dark:text-white">{title}</h3>
        {description && (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-500 dark:text-ink-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={cn("grid gap-4", cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
      {children}
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────

const IMAGE_KEYS = [
  "logoPath",
  "faviconPath",
  "heroImage",
  "homeAboutImage",
  "aboutVision2030Image",
  "ogImage",
] as const;

export function SettingsForm({ canEdit, settings }: SettingsFormProps) {
  const [active, setActive] = React.useState<SettingsTabKey>("identity");
  const { run, pending } = useAction();
  const formRef = React.useRef<HTMLFormElement>(null);

  const [images, setImages] = React.useState<Record<string, string | null>>(() =>
    Object.fromEntries(IMAGE_KEYS.map((key) => [key, settings[key] ?? null])),
  );
  const [primaryColor, setPrimaryColor] = React.useState(settings.primaryColor);
  const [accentColor, setAccentColor] = React.useState(settings.accentColor);
  const [seoDescription, setSeoDescription] = React.useState(settings.seoDescription ?? "");

  const setImage = React.useCallback((key: string, value: string | null) => {
    setImages((current) => ({ ...current, [key]: value }));
  }, []);

  const tab = SETTINGS_TABS.find((t) => t.key === active) ?? SETTINGS_TABS[0];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(() => saveSettings(active, formData));
  };

  const sendTestEmail = async () => {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    await run(() => testNotificationEmail(formData));
  };

  const restoreColors = async () => {
    const result = await run(() => resetColors());
    if (result.ok) {
      setPrimaryColor(DEFAULT_PRIMARY_COLOR);
      setAccentColor(DEFAULT_ACCENT_COLOR);
    }
  };

  // ── Panels ────────────────────────────────────────────────

  const panels: Record<SettingsTabKey, React.ReactNode> = {
    identity: (
      <div className="flex flex-col gap-5">
        <SectionCard title="أسماء الموقع" description="تظهر في العنوان والترويسة والتذييل.">
          <Grid>
            <TextField
              name="siteName"
              label="اسم الموقع بالعربية"
              defaultValue={settings.siteName}
              required
              disabled={!canEdit}
            />
            <TextField
              name="siteNameEn"
              label="اسم الموقع بالإنجليزية"
              defaultValue={settings.siteNameEn}
              dir="ltr"
              disabled={!canEdit}
            />
          </Grid>
          <TextField
            name="tagline"
            label="الشعار النصي"
            defaultValue={settings.tagline}
            hint="جملة قصيرة تظهر أسفل الاسم."
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="الشعار والأيقونة">
          <Grid>
            <ImagePicker
              name="logoPath"
              label="شعار الموقع"
              value={images.logoPath}
              onChange={(v) => setImage("logoPath", v)}
              folder="brand"
              aspect="aspect-[3/1]"
              hint="يُفضّل خلفية شفافة، وارتفاع لا يقل عن 64 بكسل."
            />
            <ImagePicker
              name="faviconPath"
              label="أيقونة المتصفح (favicon)"
              value={images.faviconPath}
              onChange={(v) => setImage("faviconPath", v)}
              folder="brand"
              aspect="square"
              hint="مربّعة 512×512 بكسل."
            />
          </Grid>
          <TextField
            name="logoAlt"
            label="النص البديل للشعار"
            defaultValue={settings.logoAlt}
            hint="وصف قصير لقارئ الشاشة، مثال: شعار مركز سوار وعي."
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="الفهرسة">
          <Checkbox
            id="blockAdminIndex"
            name="blockAdminIndex"
            defaultChecked={settings.blockAdminIndex}
            disabled={!canEdit}
            label="منع محركات البحث من فهرسة لوحة التحكم"
            description="عند إيقاف هذا الخيار قد تظهر شاشات الإدارة في نتائج البحث — لا ننصح به."
          />
        </SectionCard>
      </div>
    ),

    contact: (
      <div className="flex flex-col gap-5">
        <SectionCard title="أرقام التواصل">
          <Grid>
            <TextField
              name="phone"
              label="رقم الهاتف"
              defaultValue={settings.phone}
              type="tel"
              dir="ltr"
              placeholder="+966 5x xxx xxxx"
              disabled={!canEdit}
            />
            <TextField
              name="whatsapp"
              label="رقم الواتساب"
              defaultValue={settings.whatsapp}
              type="tel"
              dir="ltr"
              placeholder="+966 5x xxx xxxx"
              disabled={!canEdit}
            />
          </Grid>
          <TextField
            name="whatsappMessage"
            label="رسالة الواتساب الجاهزة"
            defaultValue={settings.whatsappMessage}
            multiline
            rows={3}
            hint="النص الذي يُفتح تلقائيًا عند الضغط على زر الواتساب."
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="البريد والعنوان">
          <Grid>
            <TextField
              name="email"
              label="البريد الإلكتروني"
              defaultValue={settings.email}
              type="email"
              dir="ltr"
              disabled={!canEdit}
            />
            <TextField
              name="country"
              label="الدولة"
              defaultValue={settings.country}
              disabled={!canEdit}
            />
          </Grid>
          <TextField
            name="address"
            label="العنوان"
            defaultValue={settings.address}
            multiline
            rows={2}
            disabled={!canEdit}
          />
          <TextField name="city" label="المدينة" defaultValue={settings.city} disabled={!canEdit} />
        </SectionCard>

        <SectionCard
          title="الخريطة"
          description="من خرائط جوجل: مشاركة ← تضمين خريطة ← انسخ قيمة src."
        >
          <TextField
            name="mapEmbedUrl"
            label="رابط التضمين (embed)"
            defaultValue={settings.mapEmbedUrl}
            multiline
            rows={3}
            dir="ltr"
            placeholder="https://www.google.com/maps/embed?pb=…"
            hint="انسخ رابط src داخل وسم iframe فقط."
            disabled={!canEdit}
          />
          <TextField
            name="mapLinkUrl"
            label="رابط فتح الخريطة"
            defaultValue={settings.mapLinkUrl}
            type="url"
            dir="ltr"
            placeholder="https://maps.app.goo.gl/…"
            disabled={!canEdit}
          />
        </SectionCard>
      </div>
    ),

    hours: (
      <div className="flex flex-col gap-5">
        <SectionCard
          title="ساعات العمل"
          description="تظهر في التذييل وصفحة التواصل. تُحفظ في حقل workingHoursJson."
        >
          <WorkingHoursEditor initial={settings.hours} disabled={!canEdit} />
        </SectionCard>
      </div>
    ),

    social: (
      <div className="flex flex-col gap-5">
        <SectionCard
          title="روابط الحسابات"
          description="تُحفظ في socialsJson، والتذييل يعرض ما هو غير فارغ فقط."
        >
          <SocialLinksEditor initial={settings.socials} disabled={!canEdit} />
        </SectionCard>
      </div>
    ),

    home: (
      <div className="flex flex-col gap-5">
        <SectionCard title="الواجهة الرئيسية (Hero)">
          <TextField
            name="heroBadge"
            label="النص العلوي الصغير"
            defaultValue={settings.heroBadge}
            disabled={!canEdit}
          />
          <TextField
            name="heroTitle"
            label="العنوان الرئيسي"
            defaultValue={settings.heroTitle}
            disabled={!canEdit}
          />
          <TextField
            name="heroDescription"
            label="الوصف"
            defaultValue={settings.heroDescription}
            multiline
            rows={3}
            disabled={!canEdit}
          />
          <Grid>
            <ImagePicker
              name="heroImage"
              label="صورة الواجهة"
              value={images.heroImage}
              onChange={(v) => setImage("heroImage", v)}
              folder="home"
            />
            <TextField
              name="heroImageAlt"
              label="وصف صورة الواجهة"
              defaultValue={settings.heroImageAlt}
              disabled={!canEdit}
            />
          </Grid>
        </SectionCard>

        <SectionCard title="قسم «من نحن» المختصر">
          <TextField
            name="homeAboutTitle"
            label="العنوان"
            defaultValue={settings.homeAboutTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeAboutText"
            label="النص"
            defaultValue={settings.homeAboutText}
            multiline
            disabled={!canEdit}
          />
          <Grid>
            <ImagePicker
              name="homeAboutImage"
              label="الصورة"
              value={images.homeAboutImage}
              onChange={(v) => setImage("homeAboutImage", v)}
              folder="home"
            />
            <TextField
              name="homeAboutImageAlt"
              label="وصف الصورة"
              defaultValue={settings.homeAboutImageAlt}
              disabled={!canEdit}
            />
          </Grid>
        </SectionCard>

        <SectionCard title="أقسام الصفحة الرئيسية">
          <TextField
            name="homeServicesTitle"
            label="عنوان قسم الخدمات"
            defaultValue={settings.homeServicesTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeServicesText"
            label="نص قسم الخدمات"
            defaultValue={settings.homeServicesText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
          <TextField
            name="homeServicesCtaText"
            label="نص زر الخدمات"
            defaultValue={settings.homeServicesCtaText}
            disabled={!canEdit}
          />
          <TextField
            name="homeProgramsTitle"
            label="عنوان قسم البرامج"
            defaultValue={settings.homeProgramsTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeProgramsText"
            label="نص قسم البرامج"
            defaultValue={settings.homeProgramsText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
          <TextField
            name="homeBlogTitle"
            label="عنوان قسم المدونة"
            defaultValue={settings.homeBlogTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeBlogText"
            label="نص قسم المدونة"
            defaultValue={settings.homeBlogText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
          <TextField
            name="homeTestimonialsTitle"
            label="عنوان قسم الآراء"
            defaultValue={settings.homeTestimonialsTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeFaqTitle"
            label="عنوان الأسئلة الشائعة"
            defaultValue={settings.homeFaqTitle}
            disabled={!canEdit}
          />
          <TextField
            name="homeFaqText"
            label="نص الأسئلة الشائعة"
            defaultValue={settings.homeFaqText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="الدعوة الختامية">
          <TextField
            name="finalCtaBadge"
            label="النص العلوي"
            defaultValue={settings.finalCtaBadge}
            disabled={!canEdit}
          />
          <TextField
            name="finalCtaTitle"
            label="العنوان"
            defaultValue={settings.finalCtaTitle}
            disabled={!canEdit}
          />
          <TextField
            name="finalCtaText"
            label="النص"
            defaultValue={settings.finalCtaText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
        </SectionCard>
      </div>
    ),

    about: (
      <div className="flex flex-col gap-5">
        <SectionCard title="مقدمة صفحة «من نحن»">
          <TextField
            name="aboutHeroTitle"
            label="العنوان"
            defaultValue={settings.aboutHeroTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutHeroText"
            label="النص"
            defaultValue={settings.aboutHeroText}
            multiline
            rows={3}
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="من نحن / الرؤية / الرسالة">
          <TextField
            name="aboutWhoTitle"
            label="عنوان «من نحن»"
            defaultValue={settings.aboutWhoTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutWhoText"
            label="نص «من نحن»"
            defaultValue={settings.aboutWhoText}
            multiline
            disabled={!canEdit}
          />
          <TextField
            name="aboutVisionTitle"
            label="عنوان الرؤية"
            defaultValue={settings.aboutVisionTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutVisionText"
            label="نص الرؤية"
            defaultValue={settings.aboutVisionText}
            multiline
            disabled={!canEdit}
          />
          <TextField
            name="aboutMissionTitle"
            label="عنوان الرسالة"
            defaultValue={settings.aboutMissionTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutMissionText"
            label="نص الرسالة"
            defaultValue={settings.aboutMissionText}
            multiline
            disabled={!canEdit}
          />
          <TextField
            name="aboutValuesTitle"
            label="عنوان القيم"
            defaultValue={settings.aboutValuesTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutValuesText"
            label="نص القيم"
            defaultValue={settings.aboutValuesText}
            multiline
            disabled={!canEdit}
          />
        </SectionCard>

        <SectionCard title="رؤية 2030 ولماذا نحن">
          <TextField
            name="aboutVision2030Title"
            label="عنوان رؤية 2030"
            defaultValue={settings.aboutVision2030Title}
            disabled={!canEdit}
          />
          <TextField
            name="aboutVision2030Text"
            label="نص رؤية 2030"
            defaultValue={settings.aboutVision2030Text}
            multiline
            disabled={!canEdit}
          />
          <ImagePicker
            name="aboutVision2030Image"
            label="صورة رؤية 2030"
            value={images.aboutVision2030Image}
            onChange={(v) => setImage("aboutVision2030Image", v)}
            folder="about"
          />
          <TextField
            name="aboutWhyTitle"
            label="عنوان «لماذا نحن»"
            defaultValue={settings.aboutWhyTitle}
            disabled={!canEdit}
          />
          <TextField
            name="aboutWhyText"
            label="نص «لماذا نحن»"
            defaultValue={settings.aboutWhyText}
            multiline
            disabled={!canEdit}
          />
        </SectionCard>
      </div>
    ),

    seo: (
      <div className="flex flex-col gap-5">
        <SectionCard
          title="الوصف في نتائج البحث"
          description="تظهر هذه القيم في بطاقة النتيجة داخل جوجل."
        >
          <TextField
            name="seoTitle"
            label="عنوان الصفحة"
            defaultValue={settings.seoTitle}
            disabled={!canEdit}
            hint={`${(settings.seoTitle ?? "").length} حرفًا — يُفضّل بين 30 و 60.`}
          />
          <Field
            label="وصف الصفحة"
            htmlFor="f-seoDescription"
            required={false}
            hint={
              <>
                يُعرض حتى {SEO_DESCRIPTION_LIMIT} حرفًا تقريبًا في نتائج البحث.
              </>
            }
          >
            <Textarea
              id="f-seoDescription"
              name="seoDescription"
              rows={4}
              value={seoDescription}
              disabled={!canEdit}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
          </Field>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200 dark:bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  seoDescription.length > SEO_DESCRIPTION_LIMIT ? "bg-warn-500" : "bg-success-500",
                )}
                style={{
                  width: `${Math.min(100, (seoDescription.length / SEO_DESCRIPTION_LIMIT) * 100)}%`,
                }}
              />
            </div>
            <span
              className={cn(
                "shrink-0 text-xs font-bold",
                seoDescription.length > SEO_DESCRIPTION_LIMIT
                  ? "text-warn-700 dark:text-warn-500"
                  : "text-ink-500",
              )}
            >
              {seoDescription.length} / {SEO_DESCRIPTION_LIMIT}
            </span>
          </div>
          {seoDescription.length > SEO_DESCRIPTION_LIMIT && (
            <p className="flex items-start gap-2 rounded-xl border border-warn-100 bg-warn-50 p-3 text-[0.8125rem] leading-relaxed text-warn-700 dark:border-warn-500/25 dark:bg-warn-500/10 dark:text-warn-500">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              الوصف أطول من {SEO_DESCRIPTION_LIMIT} حرفًا، وستُقتطع بقية النص في نتائج البحث.
            </p>
          )}
          <TextField
            name="seoKeywords"
            label="الكلمات المفتاحية"
            defaultValue={settings.seoKeywords}
            disabled={!canEdit}
            hint="افصل بينها بفاصلة: تعافي، إدمان، استشارات، جدة."
          />
        </SectionCard>

        <SectionCard title="صورة المشاركة (OG)">
          <ImagePicker
            name="ogImage"
            label="صورة المشاركة"
            value={images.ogImage}
            onChange={(v) => setImage("ogImage", v)}
            folder="seo"
            aspect="aspect-[1.91/1]"
            hint="المقاس الموصى به 1200×630 بكسل."
          />
        </SectionCard>

        <SectionCard title="شيفرة التحليلات">
          <div className="flex items-start gap-2 rounded-xl border border-info-100 bg-info-50 p-3 text-[0.8125rem] leading-relaxed text-info-700 dark:border-info-500/25 dark:bg-info-500/10 dark:text-info-500">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              هذا الكود يُحفظ في قاعدة البيانات ولا يُعرض إطلاقًا داخل لوحة التحكم — ولا يظهر
              لأي زائر ما لم يكن مصدره الموقع العام. الصق هنا وسم <span dir="ltr">&lt;script&gt;</span>{" "}
              الخاص بـ Google Analytics أو Google Search Console كما هو.
            </p>
          </div>
          <TextField
            name="analyticsCode"
            label="كود التحليلات / التحقق"
            defaultValue={settings.analyticsCode}
            multiline
            rows={7}
            dir="ltr"
            placeholder="<script>…</script>"
            disabled={!canEdit}
          />
        </SectionCard>
      </div>
    ),

    notify: (
      <div className="flex flex-col gap-5">
        <SectionCard title="تفعيل الإشعارات">
          <Checkbox
            id="notifyEmailEnabled"
            name="notifyEmailEnabled"
            defaultChecked={settings.notifyEmailEnabled}
            disabled={!canEdit}
            label="إرسال الإشعارات بالبريد الإلكتروني"
            description="بدون تفعيلها لا تُرسل أي رسالة تلقائية."
          />
          <TextField
            name="notificationEmail"
            label="البريد الذي تصلك عليه الإشعارات"
            defaultValue={settings.notificationEmail}
            type="email"
            dir="ltr"
            disabled={!canEdit}
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-sand-200 pt-4 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Send}
              disabled={pending || !canEdit}
              onClick={() => void sendTestEmail()}
            >
              إرسال رسالة اختبار
            </Button>
            <p className="text-xs leading-relaxed text-ink-500">
              يرسل النظام رسالة فورية للتأكد من إعدادات SMTP.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="متى تصلك رسالة؟">
          <Checkbox
            id="notifyOnNewClient"
            name="notifyOnNewClient"
            defaultChecked={settings.notifyOnNewClient}
            disabled={!canEdit}
            label="طلب استشارة جديد"
            description="يصلك تنبيه فور ملء النموذج في الموقع."
          />
          <Checkbox
            id="notifyOnNewMessage"
            name="notifyOnNewMessage"
            defaultChecked={settings.notifyOnNewMessage}
            disabled={!canEdit}
            label="رسالة جديدة من نموذج التواصل"
          />
          <Checkbox
            id="notifyOnNewBooking"
            name="notifyOnNewBooking"
            defaultChecked={settings.notifyOnNewBooking}
            disabled={!canEdit}
            label="حجز موعد جديد"
          />
        </SectionCard>
      </div>
    ),

    appearance: (
      <div className="flex flex-col gap-5">
        <SectionCard title="ألوان الهوية">
          <ColorWarning />
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              name="primaryColor"
              label="اللون الأساسي"
              value={primaryColor}
              onChange={setPrimaryColor}
              defaultValue={DEFAULT_PRIMARY_COLOR}
              disabled={!canEdit}
            />
            <ColorField
              name="accentColor"
              label="اللون المساعد"
              value={accentColor}
              onChange={setAccentColor}
              defaultValue={DEFAULT_ACCENT_COLOR}
              disabled={!canEdit}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-sand-200 pt-4 dark:border-white/10">
            <span className="flex items-center gap-2 text-xs font-bold text-ink-500">
              <Check className="size-3.5" aria-hidden />
              القيم الافتراضية:
            </span>
            <ColorDefaultMark value={DEFAULT_PRIMARY_COLOR} />
            <ColorDefaultMark value={DEFAULT_ACCENT_COLOR} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={RotateCcw}
              disabled={pending || !canEdit}
              onClick={() => void restoreColors()}
              className="ms-auto"
            >
              استعادة الألوان الافتراضية
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="معاينة سريعة">
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-5"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="text-lg font-extrabold text-white">
              {settings.siteName} — نموذج
            </span>
            <span
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-bold"
              style={{ backgroundColor: accentColor, color: "#2a1447" }}
            >
              زر بارز
            </span>
          </div>
        </SectionCard>
      </div>
    ),
  };

  // ── Render ────────────────────────────────────────────────

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
        <ShieldCheck className="size-8 text-ink-300" aria-hidden />
        <p className="font-bold text-ink-600 dark:text-ink-300">
          يمكنك الاطلاع على الإعدادات، لكن تعديلها متاح لمدير النظام فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="أقسام إعدادات الموقع"
        className="flex flex-wrap gap-2 rounded-2xl border border-sand-200 bg-white p-2 shadow-soft dark:border-white/10 dark:bg-white/5"
      >
        {SETTINGS_TABS.map(({ key, label, hint, icon: Icon }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={selected}
              aria-controls={`panel-${key}`}
              onClick={() => setActive(key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-start text-[0.8125rem] font-bold transition-colors",
                selected
                  ? "bg-brand-800 text-white"
                  : "text-ink-600 hover:bg-sand-100 hover:text-brand-800 dark:text-ink-300 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  selected ? "text-gold-300" : "text-ink-400",
                )}
                aria-hidden
              />
              <span className="flex flex-col">
                {label}
                <span
                  className={cn(
                    "text-[0.6875rem] font-medium",
                    selected ? "text-brand-100" : "text-ink-400",
                  )}
                >
                  {hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-ink-400">
        <Search className="size-3.5" aria-hidden />
        يُحفظ كل قسم على حدة — الانتقال إلى قسم آخر دون الحفظ يُهمل تعديلاتك عليه.
      </p>

      {/* Panel */}
      <form
        ref={formRef}
        onSubmit={submit}
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="flex flex-col gap-5"
      >
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
          {panels[active]}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white px-5 py-4 shadow-soft dark:border-white/10 dark:bg-white/5">
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Eye className="size-4" aria-hidden />
            بعد الحفظ تتحدّث معاينة الأعلى والصفحات العامة تلقائيًا.
          </p>
          <SubmitButton pending={pending} className="w-auto px-8">
            حفظ قسم {tab.label}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}