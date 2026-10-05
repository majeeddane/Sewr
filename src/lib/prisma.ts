import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client for the whole server process.
 *
 * Next.js dev mode re-evaluates modules on every change, so we cache the
 * instance on `globalThis` to avoid creating a new connection pool per reload.
 *
 * ── Why the pooler options are not optional ──────────────────────────────
 *
 * The app runs on Vercel, where every serverless invocation is its own
 * process with its own Prisma client and therefore its own connection pool.
 * On a normal database that is fine, but Supabase's *session* pooler allows
 * only 15 connections per user. Once more than 15 lambdas are warm at the
 * same time the rest fail with:
 *
 *   FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *          - max clients are limited to pool_size: 15
 *
 * That surfaced as intermittent 500s on /blog and /admin while every other
 * page looked healthy, which is a miserable thing to debug.
 *
 * The fix is the *transaction* pooler, which multiplexes many client
 * connections over a few real ones. It requires two settings:
 *
 *   ?pgbouncer=true        tell Prisma the server speaks the pgbouncer
 *                          protocol, so it does not try to use session-scoped
 *                          features (LISTEN/NOTIFY, advisory locks, temp
 *                          tables) that the pooler cannot support
 *   &connection_limit=1    never hold more than one real connection open
 *
 * Transactions must therefore be explicit and short. Every call site in this
 * codebase already runs a single short query or an interactive transaction, so
 * no code change is required — but if you ever add a long-running transaction
 * here, it will hold the single connection and serialise every other request.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;