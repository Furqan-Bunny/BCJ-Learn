"use server";

// Attendance — replaces the Zustand `useAttendanceStore` `checkIn` / `checkOut`
// actions with real DB-backed inserts/deletes against the `attendance` table.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function logCheckIn(moduleSlug: string): Promise<{ ok: boolean; error?: string }> {
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
    .select("id")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) {
    return { ok: false, error: "No active delivery scheduled for this module" };
  }

  const deliveryId = (delivery as { id: string }).id;

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
