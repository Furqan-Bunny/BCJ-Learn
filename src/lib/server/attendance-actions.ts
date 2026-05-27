"use server";

// Attendance — replaces the Zustand `useAttendanceStore` `checkIn` / `checkOut`
// actions with real DB-backed inserts/deletes against the `attendance` table.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentDelivery, getCheckedInStatus } from "@/lib/db/deliveries";
import { revalidatePath } from "next/cache";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Lightweight, manager-safe snapshot of the current delivery's live state.
// A client poller calls this and refreshes the page when anything changes, so
// the employee sees check-in open / session start / quiz unlock in real time
// without manually refreshing.
export async function getDeliveryPulse(
  moduleSlug: string,
): Promise<{ ok: boolean; checkinOpen: boolean; sessionStarted: boolean; sessionEnded: boolean; checkedIn: boolean }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, checkinOpen: false, sessionStarted: false, sessionEnded: false, checkedIn: false };

  const [delivery, checkin] = await Promise.all([
    getCurrentDelivery(moduleSlug),
    getCheckedInStatus(moduleSlug, user.id),
  ]);

  return {
    ok: true,
    checkinOpen: !!delivery?.checkinOpenedAt,
    sessionStarted: !!delivery?.sessionStartedAt,
    sessionEnded: !!delivery?.sessionEndedAt,
    checkedIn: checkin.checkedIn,
  };
}

export async function logCheckIn(moduleSlug: string, code?: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();

  // Find the current open delivery for this module.
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id, checkin_opened_at, checkin_code, session_started_at, session_ended_at")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) {
    return { ok: false, error: "No active delivery scheduled for this module" };
  }

  const d = delivery as {
    id: string; checkin_opened_at: string | null; checkin_code: string | null;
    session_started_at: string | null; session_ended_at: string | null;
  };

  // Gate: the trainer must have opened check-in, the session must not be over,
  // and the employee must enter the code shown in the room.
  if (!d.checkin_opened_at) {
    return { ok: false, error: "Check-in hasn't opened yet — wait for your trainer to start the seminar." };
  }
  if (d.session_ended_at) {
    return { ok: false, error: "The seminar has ended — check-in is closed." };
  }
  if (d.checkin_code && (code ?? "").trim() !== d.checkin_code) {
    return { ok: false, error: "Wrong check-in code. Enter the code shown on the screen in the room." };
  }

  const deliveryId = d.id;

  // Idempotent insert (UNIQUE(manager_id, delivery_id) in schema).
  const { error } = await admin.from("attendance").upsert(
    {
      manager_id: user.id,
      delivery_id: deliveryId,
      checked_in_at: new Date().toISOString(),
    },
    { onConflict: "manager_id,delivery_id" },
  );
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "manager_checked_in",
    actor_id: user.id,
    message: `Checked in for ${moduleSlug}`,
  });

  revalidatePath(`/manager/dashboard`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  return { ok: true };
}

export async function logCheckOut(moduleSlug: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: true }; // nothing to undo

  await admin
    .from("attendance")
    .delete()
    .eq("manager_id", user.id)
    .eq("delivery_id", (delivery as { id: string }).id);

  revalidatePath(`/manager/dashboard`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  return { ok: true };
}
