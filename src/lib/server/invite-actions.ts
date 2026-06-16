"use server";

// Self-contained invite acceptance — no Supabase email link / session needed.
// The invitee reaches /auth/accept-invite?token=… ; these actions validate that
// token (the secret) with the service-role client, so they are intentionally
// NOT admin-gated. The token is single-use and time-limited.

import { createAdminClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

interface InviteRow {
  id: string;
  name: string | null;
  email: string;
  status: string | null;
  invite_expires_at: string | null;
}

function validateRow(row: InviteRow | null):
  | { ok: true; row: InviteRow }
  | { ok: false; error: string } {
  if (!row) return { ok: false, error: "This invite link is invalid." };
  if (row.status !== "pending") return { ok: false, error: "This invite has already been used. Try signing in instead." };
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
    return { ok: false, error: "This invite link has expired. Ask your admin to resend it." };
  }
  return { ok: true, row };
}

// Look up an invite by token — used to pre-fill the accept screen.
export async function getInvite(token: string) {
  if (!token) return { ok: false as const, error: "Missing invite token." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, email, status, invite_expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  const check = validateRow(data as InviteRow | null);
  if (!check.ok) return { ok: false as const, error: check.error };
  return { ok: true as const, email: check.row.email, name: check.row.name ?? "" };
}

// Complete the invite: set the password, activate the profile, clear the token.
export async function acceptInvite(input: { token: string; name: string; password: string }) {
  const { token, name, password } = input;
  if (!token) return { ok: false as const, error: "Missing invite token." };
  if (!name.trim()) return { ok: false as const, error: "Please enter your name." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false as const, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, name, email, status, invite_expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  const check = validateRow(data as InviteRow | null);
  if (!check.ok) return { ok: false as const, error: check.error };
  const { id, email } = check.row;

  // Set the password on the auth user.
  const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password });
  if (pwErr) return { ok: false as const, error: pwErr.message };

  // Activate the profile and burn the token — CONDITIONAL on the token still
  // being present, so a double-submit (or a second tab) updates zero rows
  // instead of silently leaving the account 'pending' with a live token. The
  // error + row count are checked (the old code ignored both).
  const { data: claimed, error: updErr } = await admin
    .from("profiles")
    .update({ name: name.trim(), status: "active", invite_token: null })
    .eq("id", id)
    .eq("invite_token", token)
    .select("id");
  if (updErr) return { ok: false as const, error: updErr.message };
  if (!claimed || claimed.length === 0) {
    return { ok: false as const, error: "This invite was already completed. Please sign in instead." };
  }

  return { ok: true as const, email };
}
