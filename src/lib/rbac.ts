import type { Role } from "./enums";

/**
 * Capability-based access control.
 *
 * Every admin screen and every Server Action checks a capability — never a raw
 * role — so permissions can be tuned later without touching call sites.
 */
export const PERMISSIONS = [
  // Beneficiaries (sensitive)
  "clients.view",
  "clients.edit",
  "clients.delete",
  "clients.export",
  // Appointments
  "appointments.view",
  "appointments.edit",
  // Inbox
  "messages.view",
  "messages.reply",
  // Content
  "content.view",
  "content.edit",
  "posts.edit",
  "media.view",
  "media.upload",
  "media.delete",
  // Site
  "settings.view",
  "settings.edit",
  // Administration
  "users.view",
  "users.edit",
  "activity.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  EDITOR: [
    "content.view",
    "content.edit",
    "posts.edit",
    "media.view",
    "media.upload",
    "media.delete",
    "settings.view",
  ],
  RECEPTIONIST: [
    "clients.view",
    "clients.edit",
    "clients.export",
    "appointments.view",
    "appointments.edit",
    "messages.view",
    "messages.reply",
    "content.view",
    "media.view",
    "settings.view",
  ],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const list = MATRIX[role as Role];
  if (!list) return false;
  return list.includes(permission);
}

export function permissionsFor(role: string | null | undefined): readonly Permission[] {
  if (!role) return [];
  return MATRIX[role as Role] ?? [];
}

/** Sidebar sections filtered by role. */
export function allowedSections(role: string | null | undefined) {
  return {
    overview: true,
    clients: can(role, "clients.view"),
    appointments: can(role, "appointments.view"),
    messages: can(role, "messages.view"),
    content: can(role, "content.view"),
    posts: can(role, "posts.edit"),
    media: can(role, "media.view"),
    settings: can(role, "settings.view"),
    users: can(role, "users.view"),
    activity: can(role, "activity.view"),
  };
}
