// Helpers around the `module_resources` join — which SOPs (resources) does
// each module gate on, and has the signed-in employee acknowledged them all?

import { dbClient } from "@/lib/supabase/db-client";
import type { Resource } from "@/lib/db/resources";

export interface ModuleSopStatus extends Resource {
  signed: boolean;
  signedAt: string | null;
}

/** All SOPs linked as required for a given module. */
export async function listResourcesForModule(slug: string): Promise<Resource[]> {
  const sb = await dbClient();
  const { data: links } = await sb
    .from("module_resources")
    .select("resource_id")
    .eq("module_slug", slug);
  const ids = ((links ?? []) as { resource_id: string }[]).map((r) => r.resource_id);
  if (ids.length === 0) return [];

  const { data: rows } = await sb
    .from("resources")
    .select("*")
    .in("id", ids)
    .order("category")
    .order("title");
  return (rows ?? []) as Resource[];
}

/**
 * Same as listResourcesForModule, but enriched with the current user's
 * acknowledgement status for each SOP (signed yes/no + when).
 */
export async function listModuleSopsForUser(
  slug: string,
  userId: string,
): Promise<ModuleSopStatus[]> {
  const resources = await listResourcesForModule(slug);
  if (resources.length === 0) return [];

  const sb = await dbClient();
  const ids = resources.map((r) => r.id);
  const { data: acks } = await sb
    .from("acknowledgements")
    .select("content_ref, content_version, acknowledged_at")
    .eq("user_id", userId)
    .eq("content_type", "resource")
    .in("content_ref", ids);

  const ackByRef = new Map<string, { version: number; at: string }>();
  for (const a of ((acks ?? []) as { content_ref: string; content_version: number; acknowledged_at: string }[])) {
    const prev = ackByRef.get(a.content_ref);
    if (!prev || a.content_version > prev.version) {
      ackByRef.set(a.content_ref, { version: a.content_version, at: a.acknowledged_at });
    }
  }

  return resources.map((r) => {
    const ack = ackByRef.get(r.id);
    const signed = !!ack && ack.version >= r.version;
    return { ...r, signed, signedAt: ack?.at ?? null };
  });
}

/** True when every required SOP for the module is signed at its current version. */
export async function hasSignedAllSops(slug: string, userId: string): Promise<boolean> {
  const sops = await listModuleSopsForUser(slug, userId);
  return sops.every((s) => s.signed);
}
