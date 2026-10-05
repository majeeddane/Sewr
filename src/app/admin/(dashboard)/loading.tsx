import { Skeleton } from "@/components/admin/widgets";

/**
 * Shown while a dashboard section loads.
 *
 * Without this, Next.js has nothing to paint during the server round trip, so
 * the interface appears frozen for the whole duration. On a distant database
 * region that is most of a second per section, which read as "the dashboard is
 * broken" rather than "it is loading".
 *
 * The shape mirrors AdminPageHeader plus a table, so the layout does not jump
 * when the real content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">جارٍ تحميل القسم…</span>

      <header className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-11 rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}