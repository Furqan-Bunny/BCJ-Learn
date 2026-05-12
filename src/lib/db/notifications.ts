// Notifications log — DB queries for the admin "Recent sends" sidebar.
//
// Every email dispatched via `src/lib/emails/send.ts` is logged into the
// `notifications` table at the same time it goes out. This file exposes
// admin-facing reads for that log.

import { dbClient } from "@/lib/supabase/db-client";
import type { NotificationItem, NotificationKind } from "@/types";

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  recipient_id: string;
  subject: string;
  preview: string;
  sent_at: string;
  opened: boolean;
}

function rowToNotification(r: NotificationRow): NotificationItem {
  return {
    id: r.id,
    kind: r.kind,
    recipientId: r.recipient_id,
    subject: r.subject,
    preview: r.preview,
    sentAt: r.sent_at,
    opened: r.opened,
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
