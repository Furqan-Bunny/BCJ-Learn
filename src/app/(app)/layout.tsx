import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RouteTransition } from "@/components/layout/route-transition";
import { RouteProgress } from "@/components/layout/route-progress";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listMyNotifications, getMyUnreadCount } from "@/lib/db/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [items, unreadCount] = user
    ? await Promise.all([listMyNotifications(20), getMyUnreadCount()])
    : [[], 0];

  return (
    <div className="flex min-h-screen">
      <RouteProgress />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userId={user?.id ?? null}
          initialNotifications={items}
          initialUnreadCount={unreadCount}
        />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 max-w-7xl w-full mx-auto">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <WelcomeModal />
    </div>
  );
}
