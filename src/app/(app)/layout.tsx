import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RouteTransition } from "@/components/layout/route-transition";
import { RouteProgress } from "@/components/layout/route-progress";
import { NavLoaderOverlay } from "@/components/layout/nav-loader-overlay";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { SignupGate } from "@/components/onboarding/signup-gate";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listMyNotifications, getMyUnreadCount } from "@/lib/db/notifications";
import { listOutstandingSignupAcks } from "@/lib/db/resources";
import { getBrandingSettings } from "@/lib/db/settings";
import { resolveBrandingLogoUrl, buildBrandingCss } from "@/lib/branding";
import { LocaleProvider } from "@/lib/i18n/provider";
import { LanguageFab } from "@/components/shared/language-fab";
import { SHOW_SPANISH } from "@/lib/i18n";
import { redirect } from "next/navigation";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Defense-in-depth: never render the authenticated shell for a signed-out
  // visitor (middleware already redirects, but don't rely on it alone).
  if (!user && !DEMO_MODE) redirect("/login");
  const branding = await getBrandingSettings();
  const logoUrl = resolveBrandingLogoUrl(branding.logoPath);
  const brandingCss = buildBrandingCss(branding.primaryColor, branding.accentColor);
  const [items, unreadCount] = user
    ? await Promise.all([listMyNotifications(20), getMyUnreadCount()])
    : [[], 0];

  // Only employees switch to Spanish; staff (admin/teacher) stay in English.
  const locale = user?.role === "manager" && user.locale === "es" ? "es" : "en";

  // Onboarding gate: block the app shell until any sign-up resources are signed.
  // Skipped in demo mode (acknowledgements aren't persisted there).
  const signupResources = user && !DEMO_MODE ? await listOutstandingSignupAcks() : [];
  if (signupResources.length > 0 && user) {
    return (
      <LocaleProvider locale={locale}>
        {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}
        <SignupGate resources={signupResources} userName={user.name} logoUrl={logoUrl} />
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider locale={locale}>
    <div className="flex min-h-screen">
      {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}
      <RouteProgress />
      <Sidebar logoUrl={logoUrl} brandName={branding.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userId={user?.id ?? null}
          initialNotifications={items}
          initialUnreadCount={unreadCount}
        />
        <main className="relative flex-1 px-4 md:px-8 py-6 md:py-10 max-w-7xl w-full mx-auto">
          <NavLoaderOverlay />
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <WelcomeModal />
      {user?.role === "manager" && SHOW_SPANISH && <LanguageFab />}
    </div>
    </LocaleProvider>
  );
}
