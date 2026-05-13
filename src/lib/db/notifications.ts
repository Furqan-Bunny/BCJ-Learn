// Notifications log — DB queries for both the admin audit sidebar and the
// per-user notifications bell.
//
// Every email dispatched via `src/lib/emails/send.ts` is logged into the
// `notifications` table at the same time it goes out. Additionally,
// `src/lib/notifications/push.ts` writes rows for in-app events that don't
// send email.

import { dbClient } from "@/lib/supabase/db-client";
import { createClient } from "@/lib/supabase/server";
import type { NotificationItem, NotificationKind } from "@/types";

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  recipient_id: string;
  subject: string;
  preview: string;
  body: string | null;
  sent_at: string;
  opened: boolean;
  href: string | null;
}

function rowToNotification(r: NotificationRow): NotificationItem {
  return {
    id: r.id,
    kind: r.kind,
    recipientId: r.recipient_id,
    subject: r.subject,
    preview: r.preview,
    body: r.body,
    sentAt: r.sent_at,
    opened: r.opened,
    href: r.href,
  };
}

export async function listRecentNotifications(limit = 20): Promise<NotificationItem[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("notifications")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

/**
 * Per-user inbox query. Uses the cookie-bound client so RLS scopes results
 * to the authenticated recipient automatically.
 */
export async function listMyNotifications(limit = 50): Promise<NotificationItem[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

/**
 * Cheap unread count — uses count: "exact" + head: true so no rows are
 * returned, only the count. Hits the partial index added in migration 0006.
 */
export async function getMyUnreadCount(): Promise<number> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return 0;

  const { count } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("opened", false);
  return count ?? 0;
}
