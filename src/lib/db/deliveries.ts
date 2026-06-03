// Module deliveries — DB queries that mirror src/data/queries.ts:moduleDeliveries shape.
//
// A "delivery" is a single run of a module (e.g. Module 1 in March 2026).
// On re-delivery, a new row in `module_deliveries` is inserted with
// delivery_index = previous + 1; the prior row's ended_at is set to now().

import { dbClient } from "@/lib/supabase/db-client";
import type { Manager } from "@/types";

export interface DeliveryRecord {
  index: number;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  scheduledDate: string | null;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  attempts: number;
  passed: number;
  failed: number;
  participantIds: string[];
}

interface DeliveryRow {
  id: string;
  module_slug: string;
  delivery_index: number;
  started_at: string;
  ended_at: string | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  scheduled_date: string | null;
}

interface AttemptForDelivery {
  id: string;
  manager_id: string;
  module_slug: string;
  status: string;
  started_at: string;
}

/** Returns every delivery (past + current) for a module, with rollups. */
export async function listDeliveriesForModule(slug: string): Promise<DeliveryRecord[]> {
  const sb = await dbClient();
  const [{ data: deliveryRows }, { data: attemptRows }] = await Promise.all([
    sb.from("module_deliveries").select("*").eq("module_slug", slug).order("delivery_index"),
    sb.from("attempts").select("id, manager_id, module_slug, status, started_at").eq("module_slug", slug),
  ]);

  const deliveries = (deliveryRows ?? []) as DeliveryRow[];
  const attempts = (attemptRows ?? []) as AttemptForDelivery[];

  return deliveries.map((d, i): DeliveryRecord => {
    const nextStart = i < deliveries.length - 1 ? deliveries[i + 1].started_at : null;
    // Each delivery only counts the attempts made while IT was the active run —
    // i.e. on/after its own started_at. (A quiz taken before this seminar began
    // belongs to an earlier delivery, not this one.) So the current seminar shows
    // only its own quiz results, starting at zero until people actually take it.
    const startMs = new Date(d.started_at).getTime();
    const endMs = d.ended_at
      ? new Date(d.ended_at).getTime()
      : nextStart
        ? new Date(nextStart).getTime()
        : Infinity;

    const within = attempts.filter((a) => {
      const t = new Date(a.started_at).getTime();
      return t >= startMs && t < endMs;
    });
    // Only submitted attempts are real attempts — a scheduled retake (assigned,
    // not yet taken) or an abandoned in-progress row is not one.
    const submittedWithin = within.filter((a) => a.status === "passed" || a.status === "failed");
    const passed = submittedWithin.filter((a) => a.status === "passed").length;
    const failed = submittedWithin.filter((a) => a.status === "failed").length;
    const participantIds = Array.from(new Set(submittedWithin.map((a) => a.manager_id)));

    return {
      index: d.delivery_index,
      startDate: d.started_at,
      endDate: d.ended_at ?? nextStart,
      isCurrent: d.ended_at === null,
      scheduledDate: d.scheduled_date,
      sessionStartedAt: d.session_started_at,
      sessionEndedAt: d.session_ended_at,
      attempts: submittedWithin.length,
      passed,
      failed,
      participantIds,
    };
  });
}

/** Returns the current open delivery (ended_at is null), or null. */
export async function getCurrentDelivery(slug: string): Promise<{ id: string; deliveryIndex: number; startedAt: string; sessionStartedAt: string | null; sessionEndedAt: string | null; checkinOpenedAt: string | null } | null> {
  const sb = await dbClient();
  const { data } = await sb
    .from("module_deliveries")
    .select("id, delivery_index, started_at, session_started_at, session_ended_at, checkin_opened_at")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; delivery_index: number; started_at: string; session_started_at: string | null; session_ended_at: string | null; checkin_opened_at: string | null };
  return {
    id: row.id,
    deliveryIndex: row.delivery_index,
    startedAt: row.started_at,
    sessionStartedAt: row.session_started_at,
    sessionEndedAt: row.session_ended_at,
    checkinOpenedAt: row.checkin_opened_at,
  };
}

/** True if the given manager has an attendance row for the current delivery. */
export async function getCheckedInStatus(slug: string, managerId: string): Promise<{ checkedIn: boolean; checkedInAt: string | null }> {
  const sb = await dbClient();
  const delivery = await getCurrentDelivery(slug);
  if (!delivery) return { checkedIn: false, checkedInAt: null };
  const { data } = await sb
    .from("attendance")
    .select("checked_in_at")
    .eq("delivery_id", delivery.id)
    .eq("manager_id", managerId)
    .maybeSingle();
  if (!data) return { checkedIn: false, checkedInAt: null };
  return { checkedIn: true, checkedInAt: (data as { checked_in_at: string }).checked_in_at };
}

/** List of manager IDs currently checked in to the current delivery. */
export async function listCheckedInManagers(slug: string): Promise<Manager["id"][]> {
  const sb = await dbClient();
  const delivery = await getCurrentDelivery(slug);
  if (!delivery) return [];
  const { data } = await sb.from("attendance").select("manager_id").eq("delivery_id", delivery.id);
  return ((data ?? []) as { manager_id: string }[]).map((r) => r.manager_id);
}
