"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Cohort, ManagerStatus, Role } from "@/types";

// ─── Guard ────────────────────────────────────────────────
// All admin actions are server-side and gated by this check. RLS would also
// catch most mistakes, but explicit check gives clearer error messages.

async function requireAdmin(): Promise<{ ok: true; userId: string; userName: string } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await sb.from("profiles").select("role, name").eq("id", user.id).single();
  const p = profile as { role?: Role; name?: string } | null;
  if (!p || p.role !== "admin") return { ok: false, error: "Admin access required" };
  return { ok: true, userId: user.id, userName: p.name ?? "" };
}

async function logActivity(
  kind: string,
  actorId: string,
  message: string,
  targetId?: string,
) {
  const admin = createAdminClient();
  await admin.from("activity").insert({
    kind,
    actor_id: actorId,
    target_id: targetId ?? null,
    message,
  });
}

// ─── B.1 inviteUser ────────────────────────────────────────

export interface InviteUserInput {
  name: string;
  email: string;
  role: Role;
  cohort?: Cohort | null;
}

export async function inviteUser(input: InviteUserInput) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { name: input.name, role: input.role },
    redirectTo,
  });

  if (error || !data?.user) {
    return { ok: false as const, error: error?.message ?? "Failed to send invite" };
  }

  // The handle_new_user trigger created the profile with role from metadata.
  // Update cohort + name if profile didn't pick up correctly.
  await admin
    .from("profiles")
    .update({
      name: input.name,
      cohort: input.role === "manager" ? input.cohort ?? null : null,
    })
    .eq("id", data.user.id);

  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} invited ${input.name} (${input.email}) as ${input.role}${input.cohort ? ` to ${input.cohort}` : ""}`,
    data.user.id,
  );

  revalidatePath("/admin/managers");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/admins");

  return { ok: true as const, userId: data.user.id };
}

// ─── B.2 bulkInviteUsers ──────────────────────────────────

export interface BulkInviteRow {
  name: string;
  email: string;
  cohort: string;
}

export async function bulkInviteUsers(rows: BulkInviteRow[]) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error, results: [] };

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite`;

  const results: { email: string; ok: boolean; error?: string }[] = [];
  let invited = 0;

  for (const row of rows) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(row.email, {
      data: { name: row.name, role: "manager" },
      redirectTo,
    });

    if (error || !data?.user) {
      results.push({ email: row.email, ok: false, error: error?.message ?? "Failed" });
      continue;
    }

    await admin.from("profiles").update({ name: row.name, cohort: row.cohort as Cohort }).eq("id", data.user.id);
    results.push({ email: row.email, ok: true });
    invited++;
  }

  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} bulk-invited ${invited} employee${invited === 1 ? "" : "s"} (${rows.length - invited} failed)`,
  );

  revalidatePath("/admin/managers");

  return { ok: true as const, results, invited };
}

// ─── B.3 updateUser (admin editing another user) ──────────

export interface UpdateUserInput {
  userId: string;
  name?: string;
  cohort?: Cohort | null;
  status?: ManagerStatus | null;
  role?: Role;
}

export async function updateUserAsAdmin(input: UpdateUserInput) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (typeof input.name === "string" && input.name.trim()) updates.name = input.name.trim();
  if (input.cohort !== undefined) updates.cohort = input.cohort;
  if (input.status !== undefined) updates.status = input.status;
  if (input.role !== undefined) updates.role = input.role;

  if (Object.keys(updates).length === 0) return { ok: true as const };

  const { data: before } = await admin.from("profiles").select("name").eq("id", input.userId).single();
  const beforeName = (before as { name?: string } | null)?.name ?? "user";

  const { error } = await admin.from("profiles").update(updates).eq("id", input.userId);
  if (error) return { ok: false as const, error: error.message };

  const changes = Object.entries(updates).map(([k, v]) => `${k}=${v ?? "null"}`).join(", ");
  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} updated ${beforeName}: ${changes}`,
    input.userId,
  );

  revalidatePath("/admin/managers");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/managers/${input.userId}`);

  return { ok: true as const };
}

// ─── B.4 deactivate / reactivate ──────────────────────────

const BAN_FAR_FUTURE = "99999h"; // effectively forever; Supabase parses as duration

export async function deactivateUser(userId: string) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();

  // Ban the auth user for ~11 years (effectively forever; reactivate clears it)
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FAR_FUTURE,
  });
  if (banErr) return { ok: false as const, error: banErr.message };

  // Set profile status to inactive
  await admin.from("profiles").update({ status: "inactive" }).eq("id", userId);

  const { data: profile } = await admin.from("profiles").select("name").eq("id", userId).single();
  const targetName = (profile as { name?: string } | null)?.name ?? "user";

  await logActivity("user_deactivated", guard.userId, `${guard.userName} deactivated ${targetName}`, userId);

  revalidatePath("/admin/managers");
  revalidatePath(`/admin/managers/${userId}`);
  return { ok: true as const };
}

export async function reactivateUser(userId: string) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const { error: unbanErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (unbanErr) return { ok: false as const, error: unbanErr.message };

  await admin.from("profiles").update({ status: "active" }).eq("id", userId);

  const { data: profile } = await admin.from("profiles").select("name").eq("id", userId).single();
  const targetName = (profile as { name?: string } | null)?.name ?? "user";

  await logActivity("user_added", guard.userId, `${guard.userName} reactivated ${targetName}`, userId);

  revalidatePath("/admin/managers");
  revalidatePath(`/admin/managers/${userId}`);
  return { ok: true as const };
}

// ─── B.5 force password reset for a user ──────────────────

export async function forceResetPassword(userId: string) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email, name").eq("id", userId).single();
  const p = profile as { email?: string; name?: string } | null;
  if (!p?.email) return { ok: false as const, error: "User not found" };

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/reset-password`;
  const { error } = await admin.auth.resetPasswordForEmail(p.email, { redirectTo });
  if (error) return { ok: false as const, error: error.message };

  await logActivity(
    "password_reset_requested",
    guard.userId,
    `${guard.userName} sent a password reset to ${p.name ?? p.email}`,
    userId,
  );

  return { ok: true as const, email: p.email };
}
