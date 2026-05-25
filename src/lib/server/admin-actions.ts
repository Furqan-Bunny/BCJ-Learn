"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { pushInAppNotification } from "@/lib/notifications/push";
import { sendEmail } from "@/lib/emails/send";
import type { Cohort, ManagerStatus, Role } from "@/types";

// Invites expire after 7 days (keep in sync with the Supabase Auth OTP/invite
// expiry and the wording in the invite email + Add-Employee toast).
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  // Update cohort + name, and mark the invite as pending with its 7-day window.
  // Status flips to 'active' when the user accepts (accept-invite page + the
  // track_last_active trigger on first sign-in).
  const invitedAt = new Date();
  await admin
    .from("profiles")
    .update({
      name: input.name,
      cohort: input.role === "manager" ? input.cohort ?? null : null,
      status: "pending",
      invite_sent_at: invitedAt.toISOString(),
      invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
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

    const invitedAt = new Date();
    await admin.from("profiles").update({
      name: row.name,
      cohort: row.cohort as Cohort,
      status: "pending",
      invite_sent_at: invitedAt.toISOString(),
      invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
    }).eq("id", data.user.id);
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

  await pushInAppNotification({
    recipientId: userId,
    kind: "alert",
    subject: "Your account has been deactivated",
    preview: `Your BCJ Learn access was deactivated by ${guard.userName}. Contact an admin if this is unexpected.`,
    href: null,
  });

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

  await pushInAppNotification({
    recipientId: userId,
    kind: "alert",
    subject: "Welcome back — your account has been reactivated",
    preview: `Your BCJ Learn access was restored by ${guard.userName}. Sign in to pick up where you left off.`,
    href: "/login",
  });

  revalidatePath("/admin/managers");
  revalidatePath(`/admin/managers/${userId}`);
  return { ok: true as const };
}

// ─── B.4b deleteUser (permanent) ──────────────────────────
// Hard-deletes the auth user. Because profiles.id references auth.users(id)
// ON DELETE CASCADE — and every child table (attempts, attendance, notifications,
// acknowledgements, module_invitees, module_owners, …) cascades off profiles —
// this single call removes the login and all of the user's data. Audit/content
// rows (activity.actor_id, questions.approved_by, resources.created_by) are set
// null, so history is preserved.

export async function deleteUser(userId: string) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (guard.userId === userId) return { ok: false as const, error: "You can't delete your own account" };

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("name, email").eq("id", userId).single();
  const p = profile as { name?: string; email?: string } | null;
  const targetName = p?.name ?? p?.email ?? "user";

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false as const, error: error.message };

  // The profile row is gone now (cascade), so log without a target_id reference.
  await logActivity("user_deleted", guard.userId, `${guard.userName} permanently deleted ${targetName}`);

  revalidatePath("/admin/managers");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/admins");
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

// ─── B.6 resend invite ────────────────────────────────────
// Re-issues a fresh invite link for a still-pending user and emails it via our
// own branded `invite` template (Resend), then resets the 7-day window.

export async function resendInvite(userId: string) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email, name").eq("id", userId).single();
  const p = profile as { email?: string; name?: string } | null;
  if (!p?.email) return { ok: false as const, error: "User not found" };

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite`;

  // Generate a fresh action link. Try an invite link first; if the user already
  // exists and that's rejected, fall back to a magic sign-in link.
  function linkFrom(d: unknown): string | undefined {
    return (d as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  }
  let actionLink: string | undefined;
  const invite = await admin.auth.admin.generateLink({ type: "invite", email: p.email, options: { redirectTo } });
  actionLink = linkFrom(invite.data);
  if (invite.error || !actionLink) {
    const magic = await admin.auth.admin.generateLink({ type: "magiclink", email: p.email, options: { redirectTo } });
    actionLink = linkFrom(magic.data);
    if (magic.error || !actionLink) {
      return { ok: false as const, error: invite.error?.message ?? magic.error?.message ?? "Could not generate invite link" };
    }
  }

  const res = await sendEmail({
    to: p.email,
    templateKey: "invite",
    recipientUserId: userId,
    href: "/auth/accept-invite",
    variables: { name: p.name ?? "there", invite_link: actionLink },
  });
  if (!res.ok) return { ok: false as const, error: res.error };

  const invitedAt = new Date();
  await admin.from("profiles").update({
    status: "pending",
    invite_sent_at: invitedAt.toISOString(),
    invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
  }).eq("id", userId);

  await logActivity("user_added", guard.userId, `${guard.userName} resent the invite to ${p.name ?? p.email}`, userId);

  revalidatePath("/admin/managers");
  revalidatePath(`/admin/managers/${userId}`);
  return { ok: true as const, email: p.email };
}
