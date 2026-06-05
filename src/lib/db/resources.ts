// Resources hub (SOPs / non-quiz content) — DB queries + acknowledgement
// helpers. Per SOW Section 1 + May 7 call addition.

import { dbClient } from "@/lib/supabase/db-client";
import { createClient } from "@/lib/supabase/server";
import { pickLocale, type Locale } from "@/lib/i18n";
import type { Role, Cohort } from "@/types";

export interface Resource {
  id: string;
  title: string;
  category: string;
  /** Department "folder" this resource is filed under (e.g. HR, Operations). */
  department: string;
  description: string | null;
  /** Rich-text body (Markdown) when the admin types the SOP inline. */
  body: string | null;
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
  title_es: string | null;
  category: string;
  department: string | null;
  description: string | null;
  description_es: string | null;
  body: string | null;
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

function rowToResource(r: ResourceRow, locale: Locale = "en"): Resource {
  return {
    id: r.id,
    title: pickLocale(r.title, r.title_es, locale),
    category: r.category,
    department: r.department ?? "General",
    description: locale === "es" ? pickLocale(r.description, r.description_es, locale) || null : r.description,
    body: r.body,
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

  const { data: profile } = await sb.from("profiles").select("role, cohort, locale").eq("id", user.id).single();
  const p = profile as { role?: Role; cohort?: Cohort | null; locale?: string } | null;
  if (!p?.role) return [];
  const locale: Locale = p.locale === "es" ? "es" : "en";

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
    return { ...rowToResource(r, locale), ackStatus: status };
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

export interface AckStatusRow {
  userId: string;
  name: string;
  email: string;
  acked: boolean;
  acknowledgedAt: string | null;
}

/**
 * For Admin's resources drill-down — the full list of assigned users and
 * whether each has acknowledged the CURRENT version of a resource.
 */
export async function listAcknowledgementStatus(resourceId: string): Promise<AckStatusRow[]> {
  const sb = await dbClient();
  const { data: resource } = await sb
    .from("resources")
    .select("version, assigned_roles, assigned_cohorts")
    .eq("id", resourceId)
    .single();
  const r = resource as { version: number; assigned_roles: Role[]; assigned_cohorts: Cohort[] | null } | null;
  if (!r) return [];

  // Assigned users
  let assignedQ = sb.from("profiles").select("id, name, email").in("role", r.assigned_roles);
  if (r.assigned_cohorts && r.assigned_cohorts.length > 0) {
    assignedQ = assignedQ.in("cohort", r.assigned_cohorts);
  }
  const { data: people } = await assignedQ;
  const users = (people ?? []) as { id: string; name: string; email: string }[];
  if (users.length === 0) return [];

  // Who acked the current version (+ when)
  const { data: acks } = await sb
    .from("acknowledgements")
    .select("user_id, acknowledged_at")
    .eq("content_type", "resource")
    .eq("content_ref", resourceId)
    .eq("content_version", r.version)
    .in("user_id", users.map((u) => u.id));
  const ackedAtById = new Map(
    ((acks ?? []) as { user_id: string; acknowledged_at: string }[]).map((a) => [a.user_id, a.acknowledged_at]),
  );

  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      acked: ackedAtById.has(u.id),
      acknowledgedAt: ackedAtById.get(u.id) ?? null,
    }))
    .sort((a, b) => Number(a.acked) - Number(b.acked) || a.name.localeCompare(b.name));
}

// ─── Change audit (resource_versions) ──────────────────────────────────

export interface ResourceVersionSnapshot {
  title?: string;
  category?: string;
  department?: string;
  description?: string | null;
  body?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  requiresAck?: boolean;
  assignedRoles?: string[];
  assignedCohorts?: string[] | null;
}

export interface ResourceVersion {
  seq: number;
  ackVersion: number;
  snapshot: ResourceVersionSnapshot;
  changeReason: string;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: string;
}

/** Resolve profile ids -> display names in one query. */
async function resourceNamesByIds(sb: Awaited<ReturnType<typeof dbClient>>, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Map();
  const { data } = await sb.from("profiles").select("id, name").in("id", unique);
  const m = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; name: string }[]) m.set(r.id, r.name);
  return m;
}

/** Full change history for a resource, newest first, with editor names. */
export async function listResourceVersions(resourceId: string): Promise<ResourceVersion[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("resource_versions")
    .select("seq, ack_version, snapshot, change_reason, changed_by, created_at")
    .eq("resource_id", resourceId)
    .order("seq", { ascending: false });
  const rows = (data ?? []) as {
    seq: number; ack_version: number; snapshot: ResourceVersionSnapshot;
    change_reason: string; changed_by: string | null; created_at: string;
  }[];
  const names = await resourceNamesByIds(sb, rows.map((r) => r.changed_by));
  return rows.map((r) => ({
    seq: r.seq,
    ackVersion: r.ack_version,
    snapshot: r.snapshot ?? {},
    changeReason: r.change_reason,
    changedBy: r.changed_by,
    changedByName: r.changed_by ? names.get(r.changed_by) ?? null : null,
    createdAt: r.created_at,
  }));
}

// ─── Acknowledgement history ("tree", grouped by version) ──────────────

export interface AckHistoryEntry {
  version: number;
  /** The edit that introduced this version (who + when), if known. */
  requiredByName: string | null;
  requiredAt: string | null;
  acks: { name: string; acknowledgedAt: string }[];
}

/** Every acknowledgement for a resource, grouped by version (newest first). */
export async function listAcknowledgementHistory(resourceId: string): Promise<AckHistoryEntry[]> {
  const sb = await dbClient();
  const [{ data: ackRows }, { data: verRows }] = await Promise.all([
    sb.from("acknowledgements")
      .select("user_id, content_version, acknowledged_at")
      .eq("content_type", "resource")
      .eq("content_ref", resourceId),
    sb.from("resource_versions")
      .select("ack_version, change_reason, changed_by, created_at, seq")
      .eq("resource_id", resourceId),
  ]);

  const acks = (ackRows ?? []) as { user_id: string; content_version: number; acknowledged_at: string }[];
  const vers = (verRows ?? []) as { ack_version: number; change_reason: string; changed_by: string | null; created_at: string; seq: number }[];

  const names = await resourceNamesByIds(sb, [
    ...acks.map((a) => a.user_id),
    ...vers.map((v) => v.changed_by),
  ]);

  // For each ack version, the latest edit that produced it.
  const editByVersion = new Map<number, { changed_by: string | null; created_at: string }>();
  for (const v of vers.sort((a, b) => a.seq - b.seq)) editByVersion.set(v.ack_version, { changed_by: v.changed_by, created_at: v.created_at });

  const byVersion = new Map<number, AckHistoryEntry>();
  for (const a of acks) {
    if (!byVersion.has(a.content_version)) {
      const edit = editByVersion.get(a.content_version);
      byVersion.set(a.content_version, {
        version: a.content_version,
        requiredByName: edit?.changed_by ? names.get(edit.changed_by) ?? null : null,
        requiredAt: edit?.created_at ?? null,
        acks: [],
      });
    }
    byVersion.get(a.content_version)!.acks.push({
      name: names.get(a.user_id) ?? "Unknown",
      acknowledgedAt: a.acknowledged_at,
    });
  }

  return Array.from(byVersion.values())
    .map((e) => ({ ...e, acks: e.acks.sort((x, y) => +new Date(y.acknowledgedAt) - +new Date(x.acknowledgedAt)) }))
    .sort((a, b) => b.version - a.version);
}
