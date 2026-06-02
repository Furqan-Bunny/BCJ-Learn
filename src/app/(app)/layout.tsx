import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RouteTransition } from "@/components/layout/route-transition";
import { RouteProgress } from "@/components/layout/route-progress";
import { NavLoaderOverlay } from "@/components/layout/nav-loader-overlay";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listMyNotifications, getMyUnreadCount } from "@/lib/db/notifications";
import { getBrandingSettings } from "@/lib/db/settings";
import { resolveBrandingLogoUrl, buildBrandingCss } from "@/lib/branding";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const branding = await getBrandingSettings();
  const logoUrl = resolveBrandingLogoUrl(branding.logoPath);
  const brandingCss = buildBrandingCss(branding.primaryColor, branding.accentColor);
  const [items, unreadCount] = user
    ? await Promise.all([listMyNotifications(20), getMyUnreadCount()])
    : [[], 0];

  return (
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
    </div>
  );
}
