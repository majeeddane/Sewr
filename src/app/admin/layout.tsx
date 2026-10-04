import type { Metadata } from "next";

/**
 * Dashboard shell wrapper.
 *
 * Deliberately thin: fonts, colours and the toast host come from the root
 * layout, and the colour scheme is applied by a blocking script in the root
 * layout so there is no flash. The authentication guard lives in the
 * `(dashboard)` route group, which keeps `/admin/login` reachable.
 */
export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s | لوحة تحكم سوار وعي" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
