"use server";

import { randomBytes } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { pushInAppNotification } from "@/lib/notifications/push";
import { sendEmail } from "@/lib/emails/send";
import { sendPasswordResetEmail } from "@/lib/server/auth-actions";
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
  /** @deprecated legacy single-market field — write `markets` instead. */
  cohort?: Cohort | null;
  /** New: one employee can belong to multiple markets. */
  markets?: string[] | null;
  /** Optional job title (shown for admins / department leads). */
  title?: string | null;
}

export async function inviteUser(input: InviteUserInput) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl) {
    return { ok: false as const, error: "NEXT_PUBLIC_APP_URL isn't set — invite links would be broken. Configure it before inviting." };
  }

  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  // If a profile already exists for this email, DON'T hard-fail on createUser.
  // A still-pending invite → just resend it; an active account → say so clearly.
  const { data: existing } = await admin.from("profiles").select("id, status").ilike("email", email).maybeSingle();
  const ex = existing as { id: string; status: string | null } | null;
  if (ex) {
    if (ex.status === "pending") {
      const r = await resendInvite(ex.id);
      return r.ok ? { ok: true as const, userId: ex.id } : { ok: false as const, error: r.error };
    }
    return { ok: false as const, error: "That email already has an account." };
  }

  // Create the auth user WITHOUT a password and WITHOUT any Supabase email.
  // We email our own branded /auth/accept-invite?token=… link via Resend.
  const token = randomBytes(32).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });
  if (error || !data?.user) {
    return { ok: false as const, error: error?.message ?? "Failed to create user" };
  }
  const userId = data.user.id;

  const invitedAt = new Date();
  const markets = input.role === "manager"
    ? (input.markets?.length ? input.markets : input.cohort ? [input.cohort] : [])
    : [];
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      name: input.name,
      title: input.title?.trim() ? input.title.trim() : null,
      cohort: input.role === "manager" ? (markets[0] ?? null) : null,
      markets,
      status: "pending",
      invite_token: token,
      invite_sent_at: invitedAt.toISOString(),
      invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
    })
    .eq("id", userId);
  // Roll back the just-created auth user so a failure never leaves an
  // un-invitable, un-acceptable orphan account.
  if (profErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false as const, error: `Could not set up the invite: ${profErr.message}` };
  }

  const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;
  const sent = await sendEmail({
    to: email,
    templateKey: "invite",
    recipientUserId: userId,
    href: "/auth/accept-invite",
    variables: { name: input.name, invite_link: inviteLink },
  });
  if (!sent.ok) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false as const, error: sent.error ?? "Invite email failed — please try again." };
  }

  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} invited ${input.name} (${input.email}) as ${input.role}${input.cohort ? ` to ${input.cohort}` : ""}`,
    userId,
  );

  revalidatePath("/admin/managers");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/admins");

  return { ok: true as const, userId };
}

// ─── B.2 bulkInviteUsers ──────────────────────────────────

export interface BulkInviteRow {
  name: string;
  email: string;
  /** Legacy single-market value. */
  cohort: string;
  /** Full markets list parsed from the CSV row. */
  markets?: string[];
}

export async function bulkInviteUsers(rows: BulkInviteRow[]) {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false as const, error: guard.error, results: [] };

  const admin = createAdminClient();

  const results: { email: string; ok: boolean; error?: string }[] = [];
  let invited = 0;

  for (const row of rows) {
    const token = randomBytes(32).toString("hex");
    const { data, error } = await admin.auth.admin.createUser({
      email: row.email,
      email_confirm: true,
      user_metadata: { name: row.name, role: "manager" },
    });

    if (error || !data?.user) {
      results.push({ email: row.email, ok: false, error: error?.message ?? "Failed" });
      continue;
    }

    const invitedAt = new Date();
    const rowMarkets = row.markets?.length ? row.markets : (row.cohort ? [row.cohort] : []);
    await admin.from("profiles").update({
      name: row.name,
      cohort: (rowMarkets[0] ?? null) as Cohort | null,
      markets: rowMarkets,
      status: "pending",
      invite_token: token,
      invite_sent_at: invitedAt.toISOString(),
      invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
    }).eq("id", data.user.id);

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite?token=${token}`;
    const sent = await sendEmail({
      to: row.email,
      templateKey: "invite",
      recipientUserId: data.user.id,
      href: "/auth/accept-invite",
      variables: { name: row.name, invite_link: inviteLink },
    });
    if (!sent.ok) {
      results.push({ email: row.email, ok: false, error: sent.error ?? "Email failed" });
      continue;
    }
    results.push({ email: row.email, ok: true });
    invited++;
  }

  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} bulk-invited ${invited} manager${invited === 1 ? "" : "s"} (${rows.length - invited} failed)`,
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

// ─── B.3b editUserAndReinvite ─────────────────────────────
// Edit a user's name / email / title. If they're still 'pending' (haven't
// accepted their invite), re-mint the token, refresh the 7-day window, and
// re-send the invite to the (possibly new) email. Active users are just updated
// (no re-invite — they already have a password).

export interface EditUserInput {
  userId: string;
  name: string;
  email: string;
  title?: string | null;
  /** Change the user's role (Employee / Department Lead / Admin). */
  role?: Role;
}

export async function editUserAndReinvite(
  input: EditUserInput,
): Promise<{ ok: boolean; error?: string; resent?: boolean; removedOwnership?: string[] }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address" };
  // Don't let an admin demote themselves (and lock the org out of admin access).
  if (input.role !== undefined && input.userId === guard.userId && input.role !== "admin") {
    return { ok: false, error: "You can't change your own role." };
  }

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("profiles")
    .select("name, email, status, role")
    .eq("id", input.userId)
    .single();
  const before = cur as { name: string; email: string | null; status: ManagerStatus | null; role: Role | null } | null;
  if (!before) return { ok: false, error: "User not found" };

  const emailChanged = email !== (before.email ?? "").toLowerCase();

  // Update the auth email first so login + the invite both use the new address.
  if (emailChanged) {
    const { error: authErr } = await admin.auth.admin.updateUserById(input.userId, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      const dup = /registered|already|exists|duplicate/i.test(authErr.message);
      return { ok: false, error: dup ? "That email is already in use by another account." : authErr.message };
    }
  }

  const profileUpdate: Record<string, unknown> = { name };
  if (emailChanged) profileUpdate.email = email;
  if (input.title !== undefined) profileUpdate.title = input.title?.trim() ? input.title.trim() : null;
  if (input.role !== undefined) profileUpdate.role = input.role;

  const isPending = before.status === "pending";
  let resent = false;

  if (isPending) {
    const token = randomBytes(32).toString("hex");
    const invitedAt = new Date();
    profileUpdate.invite_token = token;
    profileUpdate.invite_sent_at = invitedAt.toISOString();
    profileUpdate.invite_expires_at = new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString();
  }

  const { error: upErr } = await admin.from("profiles").update(profileUpdate).eq("id", input.userId);
  if (upErr) return { ok: false, error: upErr.message };

  // Leaving the Department Lead role: a non-teacher can't own/manage modules, so
  // auto-remove their ownership (the modules become unowned until reassigned) and
  // report which ones so the UI can warn the admin to reassign them.
  let removedOwnership: string[] | undefined;
  if (before.role === "teacher" && input.role !== undefined && input.role !== "teacher") {
    const { data: owned } = await admin
      .from("module_owners")
      .select("modules ( title )")
      .eq("teacher_id", input.userId);
    const titles = ((owned ?? []) as { modules: { title: string } | { title: string }[] | null }[])
      .map((r) => (Array.isArray(r.modules) ? r.modules[0]?.title : r.modules?.title))
      .filter((t): t is string => !!t);
    await admin.from("module_owners").delete().eq("teacher_id", input.userId);
    if (titles.length > 0) removedOwnership = titles;
  }

  if (isPending) {
    const token = profileUpdate.invite_token as string;
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite?token=${token}`;
    const sent = await sendEmail({
      to: email,
      templateKey: "invite",
      recipientUserId: input.userId,
      href: "/auth/accept-invite",
      variables: { name, invite_link: inviteLink },
    });
    resent = sent.ok;
    if (!sent.ok) {
      return { ok: false, error: sent.error ?? "Saved, but the invite email failed to send." };
    }
  }

  await logActivity(
    "user_added",
    guard.userId,
    `${guard.userName} edited ${name}${emailChanged ? ` (email → ${email})` : ""}${resent ? " and re-sent the invite" : ""}`,
    input.userId,
  );

  revalidatePath("/admin/managers");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/managers/${input.userId}`);

  return { ok: true, resent, removedOwnership };
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

  // Send via our own Resend `password_reset` template (not Supabase Auth email).
  const result = await sendPasswordResetEmail({ email: p.email });
  if (!result.ok) return { ok: false as const, error: result.error };

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
  const { data: profile } = await admin.from("profiles").select("email, name, status").eq("id", userId).single();
  const p = profile as { email?: string; name?: string; status?: string } | null;
  if (!p?.email) return { ok: false as const, error: "User not found" };
  // Only pending users have an unfinished invite. Resending to an active user would
  // knock them back to 'pending' and invalidate their password — block that.
  if (p.status !== "pending") {
    return { ok: false as const, error: "This person has already accepted their invite — no need to resend." };
  }

  // Issue a fresh single-use token and email our own accept-invite link.
  const token = randomBytes(32).toString("hex");
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/accept-invite?token=${token}`;

  const res = await sendEmail({
    to: p.email,
    templateKey: "invite",
    recipientUserId: userId,
    href: "/auth/accept-invite",
    variables: { name: p.name ?? "there", invite_link: inviteLink },
  });
  if (!res.ok) return { ok: false as const, error: res.error };

  const invitedAt = new Date();
  await admin.from("profiles").update({
    status: "pending",
    invite_token: token,
    invite_sent_at: invitedAt.toISOString(),
    invite_expires_at: new Date(invitedAt.getTime() + INVITE_TTL_MS).toISOString(),
  }).eq("id", userId);

  await logActivity("user_added", guard.userId, `${guard.userName} resent the invite to ${p.name ?? p.email}`, userId);

  revalidatePath("/admin/managers");
  revalidatePath(`/admin/managers/${userId}`);
  return { ok: true as const, email: p.email };
}
