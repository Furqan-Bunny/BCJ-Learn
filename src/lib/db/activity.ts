// Activity log — DB queries matching src/data/activity.ts shape.

import { dbClient } from "@/lib/supabase/db-client";
import type { ActivityEvent, ActivityKind, NotificationItem, NotificationKind } from "@/types";

interface ActivityRow {
  id: string;
  kind: ActivityKind;
  actor_id: string | null;
  target_id: string | null;
  message: string;
  occurred_at: string;
}

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  recipient_id: string;
  subject: string;
  preview: string;
  sent_at: string;
  opened: boolean;
}

function rowToActivity(r: ActivityRow): ActivityEvent {
  return {
    id: r.id,
    kind: r.kind,
    actorId: r.actor_id ?? "",
    targetId: r.target_id ?? undefined,
    message: r.message,
    occurredAt: r.occurred_at,
  };
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

export async function listActivity(): Promise<ActivityEvent[]> {
  const sb = await dbClient();
  const { data } = await sb.from("activity").select("*").order("occurred_at", { ascending: false });
  return (data ?? []).map((r) => rowToActivity(r as ActivityRow));
}

export async function listRecentActivity(limit = 25): Promise<ActivityEvent[]> {
  const sb = await dbClient();
  const { data } = await sb.from("activity").select("*").order("occurred_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => rowToActivity(r as ActivityRow));
}

export async function listNotificationsForRecipient(recipientId: string): Promise<NotificationItem[]> {
  const sb = await dbClient();
  const { data } = await sb.from("notifications").select("*").eq("recipient_id", recipientId).order("sent_at", { ascending: false });
  return (data ?? []).map((r) => rowToNotification(r as NotificationRow));
}
