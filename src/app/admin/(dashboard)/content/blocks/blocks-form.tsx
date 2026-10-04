"use client";

import * as React from "react";
import {
  BadgeCheck,
  CircleHelp,
  Compass,
  Gem,
  Quote,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Panel } from "@/components/admin/widgets";
import { cn } from "@/lib/utils";
import {
  ListEditor,
  type BlockDescriptor,
  type BlockRow,
} from "@/components/admin/content/list-editor";

interface BlockTabEntry {
  label: string;
  /** Shown above the editor. */
  description: string;
  /** Line shown inside the editor toolbar area. */
  hint: string;
  icon: typeof Sparkles;
  descriptor: BlockDescriptor;
}

/** Next free `order` = (largest existing value) + 1. */
function nextOrder(rows: Array<{ values: Record<string, unknown> }>): number {
  let max = 0;
  for (const row of rows) {
    const value = Number(row.values.order ?? 0);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

const COMMON_FIELDS = [
  { name: "order", label: "الترتيب", type: "number" as const },
  {
    name: "isActive",
    label: "التفعيل",
    type: "checkbox" as const,
    hint: "العنصر المخفي لا يظهر في الموقع.",
  },
];

const ICON_BLOCK_FIELDS = [
  {
    name: "title",
    label: "العنوان",
    type: "text" as const,
    required: true,
    className: "sm:col-span-2",
  },
  { name: "icon", label: "الأيقونة", type: "icon" as const },
];

function iconBlock(
  model: string,
  label: string,
  description: string,
  hint: string,
  blankIcon: string,
): BlockTabEntry {
  return {
    label,
    description,
    hint,
    icon: Sparkles,
    descriptor: {
      model,
      label,
      description: hint,
      summaryField: "title",
      nextOrder,
      blank: {
        title: "",
        description: "",
        icon: blankIcon,
        order: 0,
        isActive: true,
      },
      fields: [
        ...ICON_BLOCK_FIELDS,
        {
          name: "description",
          label: "الوصف",
          type: "textarea",
          required: true,
          className: "sm:col-span-2",
          placeholder: "ماذا يحصل بالضبط؟",
        },
        ...COMMON_FIELDS,
      ],
    },
  };
}

/** Every ordered block the dashboard can edit, in one catalogue. */
function buildCatalogue(): Record<string, BlockTabEntry> {
  const trust = iconBlock(
    "TrustItem",
    "شريط الثقة",
    "الشارات الستة التي تظهر أسفل القسم الرئيسي في الصفحة الرئيسية.",
    "رتّب الشارات، وغيّر أيقوناتها أو أنشئ شارة جديدة.",
    "BadgeCheck",
  );
  trust.icon = Sparkles;
  trust.descriptor.blank.icon = "BadgeCheck";

  const process = iconBlock(
    "ProcessStep",
    "منهجية التعافي",
    "خطوات التعافي بالترتيب — تظهر كبطاقات مرقّمة.",
    "رتّب خطوات المنهجية بالترتيب الذي يهمّك.",
    "Compass",
  );
  process.icon = Compass;

  const values = iconBlock(
    "ValueItem",
    "القيم",
    "القيم التي يتبنى المركز بها تعامله مع المستفيدين.",
    "رتّب القيم حسب أولويتك في العرض.",
    "Gem",
  );
  values.icon = Gem;

  const why = iconBlock(
    "WhyItem",
    "لماذا تختارنا",
    "أسباب اختيار المركز — تظهر في صفحة «من نحن».",
    "رتّب الأسباب حسب قوة تأثيرها.",
    "Star",
  );
  why.icon = Star;

  return {
    trust,
    process,
    values,
    why,
    stats: {
      label: "الإحصائيات",
      description:
        "الأرقام المعروضة في الشريط البنفسجي. القيم الافتراضية للتوضيح فقط — استبدلها بأرقام المركز الحقيقية.",
      hint: "رتّب الأرقام، واستخدم البادئة واللاحقة للصياغة (مثال: ‎+500 أو 95%).",
      icon: TrendingUp,
      descriptor: {
        model: "Statistic",
        label: "الإحصائيات",
        description: "",
        summaryField: "label",
        nextOrder,
        blank: {
          label: "",
          value: "",
          prefix: "",
          suffix: "",
          icon: "Activity",
          isHighlight: false,
          order: 0,
          isActive: true,
        },
        fields: [
          {
            name: "label",
            label: "التسمية",
            type: "text",
            required: true,
            placeholder: "مثال: جلسة متخصصة",
          },
          {
            name: "value",
            label: "القيمة",
            type: "text",
            required: true,
            placeholder: "مثال: 500",
          },
          {
            name: "prefix",
            label: "سابقة (قبل الرقم)",
            type: "text",
            optional: true,
            placeholder: "+",
          },
          {
            name: "suffix",
            label: "لاحقة (بعد الرقم)",
            type: "text",
            optional: true,
            placeholder: "%",
          },
          { name: "icon", label: "الأيقونة", type: "icon" },
          {
            name: "isHighlight",
            label: "بطاقة بارزة",
            type: "checkbox",
            hint: "تُعرض كبطاقة كبيرة بدل رقم عادي.",
          },
          ...COMMON_FIELDS,
        ],
      },
    },
    testimonials: {
      label: "آراء المستفيدين",
      description: "شهادات المستفيدين. يمكنك إظهار الاسم أو إخفاءه بالكامل.",
      hint: "رتّب الشهادات، واضبط التقييم من نجمة إلى خمس نجوم.",
      icon: Quote,
      descriptor: {
        model: "Testimonial",
        label: "آراء المستفيدين",
        description: "",
        summaryField: "quote",
        nextOrder,
        blank: {
          quote: "",
          authorName: "",
          authorRole: "",
          rating: 5,
          isAnonymous: true,
          image: "",
          order: 0,
          isActive: true,
        },
        fields: [
          {
            name: "quote",
            label: "نص الرأي",
            type: "textarea",
            required: true,
            className: "sm:col-span-2",
            placeholder: "اكتب شهادة المستفيد كما هي.",
          },
          {
            name: "authorName",
            label: "اسم المستفيد",
            type: "text",
            optional: true,
          },
          {
            name: "authorRole",
            label: "الصفة",
            type: "text",
            optional: true,
            placeholder: "مثال: مستفيد من برنامج المتابعة",
          },
          { name: "rating", label: "التقييم", type: "rating" },
          {
            name: "image",
            label: "صورة المستفيد",
            type: "image",
            optional: true,
          },
          {
            name: "isAnonymous",
            label: "إخفاء الاسم",
            type: "checkbox",
            hint: "عند التفعيل يُعرض «مستفيد» بدل الاسم.",
          },
          ...COMMON_FIELDS,
        ],
      },
    },
    faqs: {
      label: "الأسئلة الشائعة",
      description: "أسئلة الموقع العامة مصنّفة حسب الموضوع.",
      hint: "رتّب الأسئلة داخل كل تصنيف — الترتيب هو ترتيب ظهورها.",
      icon: CircleHelp,
      descriptor: {
        model: "Faq",
        label: "الأسئلة الشائعة",
        description: "",
        summaryField: "question",
        nextOrder,
        blank: {
          question: "",
          answer: "",
          category: "عام",
          order: 0,
          isActive: true,
        },
        fields: [
          {
            name: "question",
            label: "السؤال",
            type: "text",
            required: true,
            className: "sm:col-span-2",
          },
          {
            name: "answer",
            label: "الإجابة",
            type: "textarea",
            required: true,
            className: "sm:col-span-2",
          },
          {
            name: "category",
            label: "التصنيف",
            type: "text",
            required: true,
            placeholder: "مثال: الجلسات",
            hint: "يظهر كفلتر في صفحة الأسئلة الشائعة.",
          },
          ...COMMON_FIELDS,
        ],
      },
    },
  };
}

export function BlocksForm({
  initialTab,
  rows,
  canEdit,
}: {
  initialTab: string;
  rows: Record<string, BlockRow[]>;
  canEdit: boolean;
}) {
  const catalogue = React.useMemo(() => buildCatalogue(), []);
  const keys = React.useMemo(() => Object.keys(catalogue), [catalogue]);
  const [active, setActive] = React.useState(() =>
    keys.includes(initialTab) ? initialTab : keys[0]!,
  );

  const current = catalogue[active]!;

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="كتل المحتوى"
        className="flex flex-wrap gap-2 rounded-2xl border border-sand-200 bg-white p-2 shadow-soft dark:border-white/10 dark:bg-white/5"
      >
        {keys.map((key) => {
          const entry = catalogue[key]!;
          const Icon = entry.icon;
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
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[0.8125rem] font-bold transition-colors",
                selected
                  ? "bg-brand-800 text-white shadow-soft"
                  : "text-ink-600 hover:bg-sand-100 dark:text-ink-400 dark:hover:bg-white/5",
              )}
            >
              <Icon
                className={cn("size-4", selected ? "text-gold-300" : "text-ink-400")}
                aria-hidden
              />
              {entry.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold",
                  selected
                    ? "bg-white/15 text-gold-300"
                    : "bg-sand-100 text-ink-500 dark:bg-white/10",
                )}
              >
                {rows[key]?.length ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        <Panel
          title={current.label}
          description={current.description}
          action={
            <span className="text-xs text-ink-500 dark:text-ink-400">
              {rows[active]?.length ?? 0} عنصر
            </span>
          }
        >
          <ListEditor
            key={`${active}:${(rows[active] ?? []).map((row) => row.id).join(",")}`}
            descriptor={current.descriptor}
            rows={rows[active] ?? []}
            canEdit={canEdit}
          />
        </Panel>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
        تحذير: الأرقام في «الإحصائيات» قيم افتراضية للتوضيح فقط — استبدلها بأرقام المركز الحقيقية قبل
        الإطلاق.
      </p>
    </div>
  );
}
