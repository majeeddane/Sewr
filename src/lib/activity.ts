import { prisma } from "./prisma";

/**
 * Append-only audit trail. Never throws — a logging failure must not break a
 * legitimate admin action.
 */
export interface ActivityInput {
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  ip?: string | null;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        ip: input.ip ?? null,
      },
    });
  } catch {
    /* audit logging must never break the request */
  }
}

/** Convenience wrapper that fills in the acting user from the session. */
export async function logAsCurrentUser(
  user: { id: string; name: string } | null,
  input: Omit<ActivityInput, "userId" | "userName">,
  ip?: string | null,
): Promise<void> {
  await logActivity({
    ...input,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    ip: ip ?? null,
  });
}

/** Removes audit rows older than the retention window (PDPL minimisation). */
export async function pruneActivityLog(olderThanDays = 365): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const result = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
