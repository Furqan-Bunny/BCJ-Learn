"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Insert an acknowledgement row for the current user at the resource's current version.
 * Called from the Employee viewer when they click "I have read and understood".
 */
export async function acknowledgeResource(
  resourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: resource } = await sb
    .from("resources")
    .select("version")
    .eq("id", resourceId)
    .single();
  const r = resource as { version?: number } | null;
  if (!r?.version) return { ok: false, error: "Resource not found" };

  const { error } = await sb.from("acknowledgements").insert({
    content_type: "resource",
    content_ref: resourceId,
    content_version: r.version,
    user_id: user.id,
  });

  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/manager/resources");
  return { ok: true };
}
