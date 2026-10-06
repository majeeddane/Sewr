import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/session";
import { getPublicSettings } from "@/lib/settings";
import { LogoMark } from "@/components/site/logo";
import { LoginCard } from "./login-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  // Someone already signed in has no business on this screen.
  const context = await getAuthContext();
  if (context.user) redirect("/admin");

  const { expired } = await searchParams;
  const brand = await getPublicSettings();

  // A square favicon suits this card best; a wide lockup is used only when the
  // operator confirmed the logo already contains the written name.
  const logoForLockup = brand.logoIncludesName
    ? brand.logoPath
    : (brand.faviconPath ?? brand.logoPath);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-brand-950 px-5 py-12">
      <div aria-hidden className="absolute inset-0 bg-dots opacity-25" />
      <div
        aria-hidden
        className="absolute -top-32 start-1/4 size-[34rem] rounded-full bg-brand-700/35 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 end-0 size-[26rem] rounded-full bg-gold-500/15 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-lift sm:p-9">
          <div className="mb-7 flex flex-col items-center gap-4 text-center">
            {/*
              The uploaded brand, so the sign-in screen matches the site.

              A previous version of this file rendered <LogoMark /> here, which
              is the *built-in* mark — so uploading a new logo changed the
              header while this screen kept the old artwork. The favicon is
              preferred here because a sign-in card wants a square mark; the
              full logo is used when the operator uploaded a lockup that
              already contains the name.
            */}
            {logoForLockup ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoForLockup}
                alt={brand.siteName}
                className="max-h-16 w-auto max-w-[15rem] object-contain"
              />
            ) : (
              <LogoMark size={56} />
            )}
            <div>
              <h1 className="text-xl font-extrabold text-brand-900">
                لوحة تحكم {brand.siteName}
              </h1>
              <p className="mt-1.5 text-[0.875rem] text-ink-500">
                سجّل الدخول لإدارة المحتوى وطلبات المستفيدين
              </p>
            </div>
          </div>

          <LoginCard expired={expired === "1"} />
        </div>

        <p className="mt-6 text-center text-sm text-brand-200">
          لست مسؤولًا عن الموقع؟{" "}
          <Link
            href="/"
            className="font-bold text-gold-300 underline-offset-4 hover:underline"
          >
            العودة إلى الموقع
          </Link>
        </p>
      </div>
    </main>
  );
}
