import {
  Bell,
  Clock,
  Home,
  Info,
  Mail,
  Palette,
  Search,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Vocabulary shared by the settings Server Action and the settings form.
 *
 * It lives in a plain module (not in `actions.ts`) because a `"use server"`
 * file may only export async functions — anything else has to be imported
 * from here.
 */

/** Brand defaults, mirrored in `prisma/schema.prisma`. */
export const DEFAULT_PRIMARY_COLOR = "#4B2A7B";
export const DEFAULT_ACCENT_COLOR = "#D9A441";

export type SettingsTabKey =
  | "identity"
  | "contact"
  | "hours"
  | "social"
  | "home"
  | "about"
  | "seo"
  | "notify"
  | "appearance";

export interface SettingsTabDef {
  key: SettingsTabKey;
  label: string;
  hint: string;
  icon: LucideIcon;
}

export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  { key: "identity", label: "الهوية", hint: "الاسم والشعار والأيقونة", icon: Sparkles },
  { key: "contact", label: "التواصل", hint: "الهاتف والواتساب والعنوان والخريطة", icon: Mail },
  { key: "hours", label: "ساعات العمل", hint: "أوقات الدوام لكل يوم", icon: Clock },
  { key: "social", label: "الشبكات الاجتماعية", hint: "روابط حسابات المركز", icon: Share2 },
  { key: "home", label: "الصفحة الرئيسية", hint: "نصوص الواجهة والأقسام", icon: Home },
  { key: "about", label: "من نحن", hint: "صفحة التعريف والرؤية", icon: Info },
  { key: "seo", label: "تحسين محركات البحث", hint: "الوصف والكلمات المفتاحية", icon: Search },
  { key: "notify", label: "الإشعارات", hint: "متى تصلك رسالة بريدية", icon: Bell },
  { key: "appearance", label: "المظهر", hint: "ألوان الهوية", icon: Palette },
] as const;

export const SETTINGS_TAB_KEYS = SETTINGS_TABS.map((tab) => tab.key);

export function settingsTabLabel(key: string): string {
  return SETTINGS_TABS.find((tab) => tab.key === key)?.label ?? key;
}

/** Days offered by the working-hours repeater, Sunday first. */
export const WORK_DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

export interface HoursPreset {
  label: string;
  /** Which days the preset fills. */
  days: readonly string[];
  hours: string;
}

/** One-tap starting points for `workingHoursJson`. */
export const HOURS_PRESETS: readonly HoursPreset[] = [
  {
    label: "أسبوع كامل",
    days: WORK_DAYS,
    hours: "9:00 صباحًا – 9:00 مساءً",
  },
  {
    label: "الأحد–الخميس",
    days: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
    hours: "9:00 صباحًا – 5:00 مساءً",
  },
  {
    label: "بعد صلاة الجمعة",
    days: ["الجمعة"],
    hours: "4:00 مساءً – 9:00 مساءً",
  },
  {
    label: "على مدار الساعة",
    days: WORK_DAYS,
    hours: "24 ساعة — استقبال موحّد",
  },
] as const;

/** SEO guidance shown next to the description counter. */
export const SEO_DESCRIPTION_LIMIT = 158;