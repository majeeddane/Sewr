import { prisma } from "@/lib/prisma";
import { publishDuePosts } from "@/lib/notifications";

/**
 * Cron endpoint that publishes scheduled posts.
 *
 * Configure it on Vercel (or any cron provider) to run every fifteen minutes by
 * adding a "crons" entry in vercel.json pointing at /api/cron/publish.
 * Set CRON_SECRET in the environment so the endpoint cannot be triggered by
 * anyone who guesses the URL.
 *
 * The blog index and the admin dashboard also publish overdue posts
 * opportunistically, so a missed cron run never leaves an article stuck.
 */
export async function GET(request: Request) {
  // Shared-secret check so the endpoint cannot be triggered by anyone.
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (secret && provided !== secret) {
    return Response.json(
      { ok: false, message: "غير مصرّح." },
      { status: 401 },
    );
  }

  try {
    const published = await publishDuePosts();

    // Housekeeping: drop expired sessions so the table does not grow forever.
    const sessions = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Trim old login attempts (PDPL data minimisation).
    const attempts = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
    });

    return Response.json({
      ok: true,
      published,
      removedSessions: sessions.count,
      removedLoginAttempts: attempts.count,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron] فشل:", error);
    return Response.json(
      { ok: false, message: "تعذّر تنفيذ المهمة." },
      { status: 500 },
    );
  }
}
