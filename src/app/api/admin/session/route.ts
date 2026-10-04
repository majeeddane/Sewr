import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

/**
 * Lightweight heartbeat for the dashboard.
 *
 * The layout already re-reads the session on every navigation, so this endpoint
 * exists for the inactivity banner: the client pings it periodically and gets
 * back `authenticated: true|false`, which triggers the login redirect the
 * moment the idle timeout has elapsed — without the user losing unsaved work
 * to a surprise redirect on their next click.
 */
export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json(
    {
      authenticated: Boolean(user),
      user: user ? { id: user.id, name: user.name, role: user.role } : null,
      at: new Date().toISOString(),
    },
    {
      // Never cached: this is a session probe.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
