import { getPublicSettings } from "@/lib/settings";
import { whatsappNumber } from "@/lib/crypto";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { WhatsAppFab } from "@/components/site/whatsapp-fab";

/**
 * Public site shell.
 *
 * Lives in the `(site)` route group so the marketing chrome never wraps the
 * dashboard. Route groups do not affect URLs, so the public paths are exactly
 * `/`, `/about`, `/services/…` and so on.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPublicSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        تخطَّ إلى المحتوى الرئيسي
      </a>

      <SiteHeader logoPath={settings.logoPath} phone={settings.phone} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter />

      <WhatsAppFab
        number={whatsappNumber(settings.whatsapp || settings.phone)}
        message={settings.whatsappMessage}
        phone={settings.phone}
      />
    </div>
  );
}
