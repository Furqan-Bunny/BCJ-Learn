"use server";

// Mark-read server actions for the notifications bell. Use the cookie-bound
// client so RLS enforces `recipient_id = auth.uid()` — even if a malicious
// caller passes someone else's id, the policy blocks the update.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await sb
    .from("notifications")
    .update({ opened: true, opened_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await sb
    .from("notifications")
    .update({ opened: true, opened_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .eq("opened", false);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
