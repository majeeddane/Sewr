import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/session";
import { allowedSections } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPublicSettings } from "@/lib/settings";
import { AdminSidebar } from "@/components/admin/shell";
import { logoutAction } from "@/app/admin/actions";

// The dashboard is per-user and per-request: it must never be cached.
export const dynamic = "force-dynamic";

/**
 * Guarded dashboard shell.
 *
 * Every screen below this layout is guaranteed to have an authenticated,
 * active user with the right role — individual screens still check the specific
 * capability they need before acting.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthContext();

  if (!context.user) {
    redirect(context.expired ? "/admin/login?expired=1" : "/admin/login");
  }

  const [unreadMessages, newClients, brand] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false, isArchived: false } }),
    prisma.client.count({ where: { status: "NEW" } }),
    // The dashboard shows the same brand as the public site, so the operator
    // sees in the sidebar exactly what a visitor will see.
    getPublicSettings(),
  ]);

  return (
    <div className="min-h-dvh bg-sand-100 dark:bg-[#14101c]">
      <a href="#admin-main" className="skip-link">
        تخطَّ إلى المحتوى
      </a>

      <AdminSidebar
        sections={allowedSections(context.user.role)}
        userName={context.user.name}
        userRole={context.user.role}
        badges={{ messages: unreadMessages, clients: newClients }}
        logo={{
          path: brand.logoPath,
          includesName: brand.logoIncludesName,
          siteName: brand.siteName,
          siteNameEn: brand.siteNameEn,
        }}
        onLogout={logoutAction}
      />
      <div className="lg:ps-[17rem]">
        <main
          id="admin-main"
          className="px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
