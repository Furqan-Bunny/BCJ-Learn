"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { pushInAppNotification } from "@/lib/notifications/push";
import { listAcknowledgementStatus, type AckStatusRow } from "@/lib/db/resources";
import type { Role } from "@/types";

async function requireAdmin(): Promise<
  { ok: true; userId: string; userName: string } | { ok: false; error: string }
> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await sb.from("profiles").select("role, name").eq("id", user.id).single();
  const p = data as { role?: string; name?: string } | null;
  if (p?.role !== "admin") {
    return { ok: false, error: "Admin access required" };
  }
  return { ok: true, userId: user.id, userName: p.name ?? "An admin" };
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Snapshot the current resource state into resource_versions (best-effort). */
async function snapshotResourceVersion(
  admin: AdminClient,
  resourceId: string,
  changeReason: "created" | "edited",
  userId: string,
): Promise<void> {
  try {
    const { data: r } = await admin
      .from("resources")
      .select("title, category, department, description, body, storage_path, external_url, requires_ack, assigned_roles, assigned_cohorts, version")
      .eq("id", resourceId)
      .maybeSingle();
    if (!r) return;
    const row = r as Record<string, unknown> & { version: number };
    const { data: last } = await admin
      .from("resource_versions")
      .select("seq")
      .eq("resource_id", resourceId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSeq = ((last as { seq?: number } | null)?.seq ?? 0) + 1;
    await admin.from("resource_versions").insert({
      resource_id: resourceId,
      seq: nextSeq,
      ack_version: row.version,
      change_reason: changeReason,
      changed_by: userId,
      snapshot: {
        title: row.title,
        category: row.category,
        department: row.department,
        description: row.description,
        body: row.body,
        storagePath: row.storage_path,
        externalUrl: row.external_url,
        requiresAck: row.requires_ack,
        assignedRoles: row.assigned_roles,
        assignedCohorts: row.assigned_cohorts,
      },
    });
  } catch {
    // Auditing must never block the write.
  }
}

/** Best-effort entry in the global activity feed for a resource change. */
async function logResourceActivity(admin: AdminClient, userId: string, message: string): Promise<void> {
  try {
    await admin.from("activity").insert({ kind: "resource_updated", actor_id: userId, target_id: null, message });
  } catch {
    // ignore
  }
}

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

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface ResourceInput {
  title: string;
  category: string;
  department?: string;
  description?: string | null;
  body?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  requiresAck: boolean;
  assignedRoles: Role[];
  assignedCohorts?: string[] | null;
  notifyOnUpdate: boolean;
}

// ─── createResource (admin) ────────────────────────────────────────────
export async function createResource(
  input: ResourceInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!input.title.trim()) return { ok: false, error: "Title is required" };
  if (!input.assignedRoles?.length) return { ok: false, error: "Pick at least one audience role" };
  if (DEMO_MODE) return { ok: true, id: "demo" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("resources")
    .insert({
      title: input.title.trim(),
      category: input.category.trim() || "General",
      department: input.department?.trim() || "General",
      description: input.description ?? null,
      body: input.body ?? null,
      storage_path: input.storagePath ?? null,
      external_url: input.externalUrl ?? null,
      requires_ack: input.requiresAck,
      assigned_roles: input.assignedRoles,
      assigned_cohorts: input.assignedCohorts?.length ? input.assignedCohorts : null,
      notify_on_update: input.notifyOnUpdate,
      created_by: guard.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const newId = (data as { id: string }).id;
  await snapshotResourceVersion(admin, newId, "created", guard.userId);
  await logResourceActivity(admin, guard.userId, `${guard.userName} created resource "${input.title.trim()}"`);

  revalidatePath("/admin/resources");
  revalidatePath("/manager/resources");
  return { ok: true, id: newId };
}

// ─── editResource (admin) ──────────────────────────────────────────────
// When `requireReack` is true the version is bumped so every assigned user
// must sign again, and they get an in-app notification. Otherwise it's a
// silent update (e.g. fixing a typo) that leaves existing acks valid.
export async function editResource(
  id: string,
  input: ResourceInput & { requireReack: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!input.title.trim()) return { ok: false, error: "Title is required" };
  if (!input.assignedRoles?.length) return { ok: false, error: "Pick at least one audience role" };
  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: current } = await admin.from("resources").select("version, title").eq("id", id).maybeSingle();
  const cur = current as { version: number; title: string } | null;
  if (!cur) return { ok: false, error: "Resource not found" };

  const update: Record<string, unknown> = {
    title: input.title.trim(),
    category: input.category.trim() || "General",
    department: input.department?.trim() || "General",
    description: input.description ?? null,
    body: input.body ?? null,
    storage_path: input.storagePath ?? null,
    external_url: input.externalUrl ?? null,
    requires_ack: input.requiresAck,
    assigned_roles: input.assignedRoles,
    assigned_cohorts: input.assignedCohorts?.length ? input.assignedCohorts : null,
    notify_on_update: input.notifyOnUpdate,
  };
  if (input.requireReack) update.version = cur.version + 1;

  const { error } = await admin.from("resources").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // On re-ack, notify everyone the resource is assigned to so they re-sign.
  if (input.requireReack) {
    // profiles.role is a scalar enum — match the assigned roles with `in`.
    const { data: people } = await admin
      .from("profiles")
      .select("id, cohort")
      .in("role", input.assignedRoles as string[]);
    const cohorts = input.assignedCohorts?.length ? new Set(input.assignedCohorts) : null;
    const recipients = ((people ?? []) as { id: string; cohort: string | null }[]).filter(
      (p) => !cohorts || (p.cohort && cohorts.has(p.cohort)),
    );
    await Promise.all(
      recipients.map((p) =>
        pushInAppNotification({
          recipientId: p.id,
          kind: "alert",
          subject: `Updated: ${input.title.trim()}`,
          preview: `"${input.title.trim()}" was updated — please review and acknowledge the new version.`,
          href: "/manager/resources",
        }),
      ),
    );
  }

  await snapshotResourceVersion(admin, id, "edited", guard.userId);
  await logResourceActivity(
    admin,
    guard.userId,
    `${guard.userName} updated resource "${input.title.trim()}"${input.requireReack ? " (re-acknowledgement required)" : ""}`,
  );

  revalidatePath("/admin/resources");
  revalidatePath("/manager/resources");
  revalidatePath(`/admin/resources/${id}`);
  return { ok: true };
}

// ─── deleteResource (admin) ────────────────────────────────────────────
// Removes the resource. module_resources links cascade away (migration 0022);
// past acknowledgements are left as-is (their content_ref simply dangles).
export async function deleteResource(id: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("resources").select("title").eq("id", id).maybeSingle();
  const title = (existing as { title?: string } | null)?.title ?? "a resource";
  const { error } = await admin.from("resources").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logResourceActivity(admin, guard.userId, `${guard.userName} deleted resource "${title}"`);

  revalidatePath("/admin/resources");
  revalidatePath("/manager/resources");
  return { ok: true };
}

/** Admin drill-down: who has / hasn't acknowledged the current version of a resource. */
export async function getAcknowledgementStatus(
  resourceId: string,
): Promise<{ ok: true; rows: AckStatusRow[] } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  const rows = await listAcknowledgementStatus(resourceId);
  return { ok: true, rows };
}
