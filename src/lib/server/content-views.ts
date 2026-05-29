"use server";

// Content-view tracking for the live presenter. When an employee moves past a
// content item, we record it so the outline's "completed" state survives
// navigation, reloads, and re-opening the presenter. Used by the teacher
// presenter (read + write) and the admin reporting views (read).

import { createClient, createAdminClient } from "@/lib/supabase/server";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Mark a content item as viewed for the signed-in user in the current open
 * delivery. Idempotent — re-recording is a no-op (UNIQUE constraint).
 */
export async function recordContentView(
  moduleSlug: string,
  contentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) return { ok: true };

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient();
  // Find the current open delivery — same lookup used everywhere else.
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "No open delivery for this module" };

  const { error } = await admin
    .from("content_views")
    .upsert(
      {
        delivery_id: (delivery as { id: string }).id,
        user_id: user.id,
        content_id: contentId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "delivery_id,user_id,content_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Load the set of content IDs the user has already viewed in the current
 * open delivery. Called from the presenter page on mount to hydrate state.
 */
export async function getViewedContentIds(moduleSlug: string): Promise<string[]> {
  if (DEMO_MODE) return [];

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return [];

  const { data: rows } = await admin
    .from("content_views")
    .select("content_id")
    .eq("delivery_id", (delivery as { id: string }).id)
    .eq("user_id", user.id);
  return ((rows ?? []) as { content_id: string }[]).map((r) => r.content_id);
}
