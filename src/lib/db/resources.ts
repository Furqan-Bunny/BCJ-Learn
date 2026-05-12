// Resources hub (SOPs / non-quiz content) — DB queries + acknowledgement
// helpers. Per SOW Section 1 + May 7 call addition.

import { dbClient } from "@/lib/supabase/db-client";
import { createClient } from "@/lib/supabase/server";
import type { Role, Cohort } from "@/types";

export interface Resource {
  id: string;
  title: string;
  category: string;
  description: string | null;
  storagePath: string | null;
  externalUrl: string | null;
  version: number;
  requiresAck: boolean;
  assignedRoles: Role[];
  assignedCohorts: Cohort[] | null;
  notifyOnUpdate: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResourceRow {
  id: string;
  title: string;
  category: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  version: number;
  requires_ack: boolean;
  assigned_roles: Role[];
  assigned_cohorts: Cohort[] | null;
  notify_on_update: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToResource(r: ResourceRow): Resource {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    storagePath: r.storage_path,
    externalUrl: r.external_url,
    version: r.version,
    requiresAck: r.requires_ack,
    assignedRoles: r.assigned_roles,
    assignedCohorts: r.assigned_cohorts,
    notifyOnUpdate: r.notify_on_update,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listResources(): Promise<Resource[]> {
  const sb = await dbClient();
  const { data } = await sb.from("resources").select("*").order("category").order("title");
  return (data ?? []).map((r) => rowToResource(r as ResourceRow));
}

export async function getResource(id: string): Promise<Resource | null> {
  const sb = await dbClient();
  const { data } = await sb.from("resources").select("*").eq("id", id).single();
  return data ? rowToResource(data as ResourceRow) : null;
}

/**
 * Resources assigned to the current user, with their per-resource ack status.
 * Used by the Employee-facing /manager/resources page.
 */
export async function listResourcesForCurrentUser(): Promise<
  (Resource & { ackStatus: "new" | "acknowledged" | "updated" })[]
> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data: profile } = await sb.from("profiles").select("role, cohort").eq("id", user.id).single();
  const p = profile as { role?: Role; cohort?: Cohort | null } | null;
  if (!p?.role) return [];

  const dbc = await dbClient();
  const { data: resources } = await dbc
    .from("resources")
    .select("*")
    .contains("assigned_roles", [p.role]);

  // Filter by cohort (assigned_cohorts null = all cohorts)
  const filtered = ((resources ?? []) as ResourceRow[]).filter((r) => {
    if (!r.assigned_cohorts || r.assigned_cohorts.length === 0) return true;
    return p.cohort ? r.assigned_cohorts.includes(p.cohort) : false;
  });

  if (filtered.length === 0) return [];

  // Fetch latest acks for these resources from this user
  const { data: acks } = await dbc
    .from("acknowledgements")
    .select("content_ref, content_version")
    .eq("user_id", user.id)
    .eq("content_type", "resource")
    .in("content_ref", filtered.map((r) => r.id));

  const ackVersions = new Map<string, number>();
  for (const a of (acks ?? []) as { content_ref: string; content_version: number }[]) {
    const existing = ackVersions.get(a.content_ref) ?? 0;
    if (a.content_version > existing) ackVersions.set(a.content_ref, a.content_version);
  }

  return filtered.map((r) => {
    const lastAckVersion = ackVersions.get(r.id);
    let status: "new" | "acknowledged" | "updated";
    if (lastAckVersion === undefined) status = "new";
    else if (lastAckVersion < r.version) status = "updated";
    else status = "acknowledged";
    return { ...rowToResource(r), ackStatus: status };
  });
}

/**
 * For Admin's resources management page — how many assigned users have
 * acknowledged the CURRENT version of a given resource.
 */
export async function ackCountForResource(resourceId: string): Promise<{ acked: number; total: number }> {
  const sb = await dbClient();
  const { data: resource } = await sb.from("resources").select("version, assigned_roles, assigned_cohorts").eq("id", resourceId).single();
  const r = resource as { version: number; assigned_roles: Role[]; assigned_cohorts: Cohort[] | null } | null;
  if (!r) return { acked: 0, total: 0 };

  // Count assigned users
  let assignedQ = sb.from("profiles").select("id", { count: "exact", head: true }).in("role", r.assigned_roles);
  if (r.assigned_cohorts && r.assigned_cohorts.length > 0) {
    assignedQ = assignedQ.in("cohort", r.assigned_cohorts);
  }
  const { count: total } = await assignedQ;

  // Count acks at current version
  const { count: acked } = await sb
    .from("acknowledgements")
    .select("*", { count: "exact", head: true })
    .eq("content_type", "resource")
    .eq("content_ref", resourceId)
    .eq("content_version", r.version);

  return { acked: acked ?? 0, total: total ?? 0 };
}
