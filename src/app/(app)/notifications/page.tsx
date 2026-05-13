// User-facing notifications inbox. Any role can visit; sees only their own
// rows (RLS-enforced). Different from /admin/notifications which is the
// admin's audit view of all outbound sends.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyNotifications, getMyUnreadCount } from "@/lib/db/notifications";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsInboxView } from "./inbox-view";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default async function NotificationsPage() {
  if (!DEMO_MODE) {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) redirect("/login");
  }

  const [items, unreadCount] = await Promise.all([
    listMyNotifications(50),
    getMyUnreadCount(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Every alert, reminder, and result that's been sent to you."
      />
      <NotificationsInboxView items={items} initialUnreadCount={unreadCount} />
    </>
  );
}
