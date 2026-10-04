/**
 * Domain vocabulary.
 *
 * The database stores these as plain strings so the same schema runs on SQLite
 * (development) and PostgreSQL (production) without changes — PostgreSQL enums
 * are not portable to SQLite and make migrations painful. These unions plus the
 * Arabic label maps are the single source of truth.
 */

// ── Roles ─────────────────────────────────────────────────────
export const ROLES = ["SUPER_ADMIN", "EDITOR", "RECEPTIONIST"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "مدير عام",
  EDITOR: "محرر محتوى",
  RECEPTIONIST: "موظف استقبال",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN:
    "صلاحيات كاملة: المستخدمون، الإعدادات، المحتوى، المستفيدون، المواعيد، السجلات.",
  EDITOR:
    "يدير المدونة وكل النصوص والصور، دون الاطلاع على بيانات المستفيدين.",
  RECEPTIONIST:
    "يدير طلبات الاستشارة والمواعيد وصندوق الرسائل فقط.",
};

// ── Client status ─────────────────────────────────────────────
export const CLIENT_STATUSES = [
  "NEW",
  "CONTACTED",
  "BOOKED",
  "COMPLETED",
  "CLOSED",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  NEW: "جديد",
  CONTACTED: "تم التواصل",
  BOOKED: "محجوز",
  COMPLETED: "مكتمل",
  CLOSED: "مغلق",
};

export const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  NEW: "bg-sky-100 text-sky-800 ring-sky-200",
  CONTACTED: "bg-amber-100 text-amber-900 ring-amber-200",
  BOOKED: "bg-violet-100 text-violet-800 ring-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-stone-200 text-stone-700 ring-stone-300",
};

// ── Appointments ──────────────────────────────────────────────
export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "DONE",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "بانتظار التأكيد",
  CONFIRMED: "مؤكد",
  CANCELLED: "ملغي",
  DONE: "تمّت الجلسة",
  NO_SHOW: "لم يحضر",
};

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 ring-amber-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 ring-rose-200",
  DONE: "bg-violet-100 text-violet-800 ring-violet-200",
  NO_SHOW: "bg-stone-200 text-stone-700 ring-stone-300",
};

// ── Content types ─────────────────────────────────────────────
export const CONTENT_TYPES = ["SERVICE", "PROGRAM", "PROTOCOL"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SERVICE: "خدمة",
  PROGRAM: "برنامج",
  PROTOCOL: "بروتوكول",
};

export const CONTENT_TYPE_PATHS: Record<ContentType, string> = {
  SERVICE: "/services",
  PROGRAM: "/programs",
  PROTOCOL: "/protocols",
};

// ── Posts ─────────────────────────────────────────────────────
export const POST_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدول",
  PUBLISHED: "منشور",
};

// ── Lead source ───────────────────────────────────────────────
export const CLIENT_SOURCES = [
  "الموقع الإلكتروني",
  "إنستغرام",
  "تويتر / X",
  "لينكدإن",
  "توصية من مستفيد",
  "توصية من مؤسسة",
  "فعالية أو ورشة",
  "محركات البحث",
  "حملة إعلانية",
  "أخرى",
] as const;

// ── "Who is asking?" ──────────────────────────────────────────
export const WHO_IS_ASKING = [
  { value: "SELF", label: "عن نفسي" },
  { value: "FAMILY", label: "عن أحد أفراد الأسرة" },
  { value: "INSTITUTION", label: "عن مؤسسة / جهة" },
  { value: "OTHER", label: "عن شخص آخر" },
] as const;

export const WHO_IS_ASKING_LABELS: Record<string, string> = Object.fromEntries(
  WHO_IS_ASKING.map((o) => [o.value, o.label]),
);

// ── Preferred contact method ──────────────────────────────────
export const CONTACT_METHODS = [
  { value: "PHONE", label: "مكالمة هاتفية" },
  { value: "WHATSAPP", label: "واتساب" },
  { value: "EMAIL", label: "بريد إلكتروني" },
] as const;

export const CONTACT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_METHODS.map((o) => [o.value, o.label]),
);

// ── Activity log ──────────────────────────────────────────────
export const ACTIVITY_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "PUBLISH",
  "UNPUBLISH",
  "SCHEDULE",
  "EXPORT",
  "UPLOAD",
  "RESET_PASSWORD",
  "SETTINGS",
] as const;

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  PUBLISH: "نشر",
  UNPUBLISH: "إلغاء نشر",
  SCHEDULE: "جدولة",
  EXPORT: "تصدير",
  UPLOAD: "رفع ملف",
  RESET_PASSWORD: "إعادة تعيين كلمة المرور",
  SETTINGS: "تعديل الإعدادات",
};

export const ENTITY_LABELS: Record<string, string> = {
  Client: "مستفيد",
  Appointment: "موعد",
  ContactMessage: "رسالة",
  Post: "مقال",
  ContentItem: "محتوى",
  SiteSetting: "إعدادات الموقع",
  User: "مستخدم",
  MediaAsset: "ملف وسائط",
  Category: "تصنيف",
  Tag: "وسم",
  Faq: "سؤال شائع",
  Testimonial: "رأي",
  Statistic: "إحصائية",
  Page: "صفحة",
  Session: "جلسة",
};

// ── Guard used by the public forms ────────────────────────────
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isClientStatus(value: unknown): value is ClientStatus {
  return (
    typeof value === "string" &&
    (CLIENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isAppointmentStatus(
  value: unknown,
): value is AppointmentStatus {
  return (
    typeof value === "string" &&
    (APPOINTMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isPostStatus(value: unknown): value is PostStatus {
  return (
    typeof value === "string" &&
    (POST_STATUSES as readonly string[]).includes(value)
  );
}

export function isContentType(value: unknown): value is ContentType {
  return (
    typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
  );
}
