"use server";

// Opt-in email-OTP second factor for password sign-in.
// requestLoginOtp verifies the password (only when 2FA is on) and emails a code;
// verifyLoginOtp checks the code. The browser then runs the real
// signInWithPassword to establish the session — so no session is created until
// the code is confirmed.

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails/send";

/**
 * Record a sign-in in the audit log. Called by the login page right after the
 * browser establishes a session (cookies are set, so getUser resolves). Best
 * effort — never blocks or fails the login.
 */
export async function logSignIn(): Promise<void> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const name = (profile as { name?: string } | null)?.name ?? user.email ?? "A user";
    await admin.from("activity").insert({
      kind: "user_login",
      actor_id: user.id,
      target_id: null,
      message: `${name} signed in`,
    });
  } catch {
    // Swallow — auditing must never break sign-in.
  }
}

const CODE_TTL_MS = 10 * 60 * 1000;

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Step 1 — called with email+password. Returns whether an OTP step is needed.
export async function requestLoginOtp(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { ok: false as const, error: "Email and password are required." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, two_factor_enabled")
    .ilike("email", normalized)
    .maybeSingle();

  const p = profile as { id: string; name: string | null; two_factor_enabled: boolean } | null;

  // No account, or 2FA off → let the browser do the normal sign-in (which
  // validates the password). Identical response either way = no enumeration.
  if (!p || !p.two_factor_enabled) {
    return { ok: true as const, requiresOtp: false as const };
  }

  // 2FA on → verify the password before emailing any code (throwaway client,
  // anon key, no session persisted → no cookies set).
  const verifier = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: pwErr } = await verifier.auth.signInWithPassword({ email: normalized, password });
  if (pwErr) return { ok: false as const, error: "Invalid email or password." };

  const code = genCode();
  await admin.from("email_otps").delete().eq("email", normalized);
  const { error: insErr } = await admin.from("email_otps").insert({
    email: normalized,
    code,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (insErr) return { ok: false as const, error: "Could not start verification. Try again." };

  const sent = await sendEmail({
    to: normalized,
    templateKey: "login_code",
    variables: { name: p.name ?? "there", code },
  });
  if (!sent.ok) return { ok: false as const, error: sent.error ?? "Could not send the code email." };

  return { ok: true as const, requiresOtp: true as const };
}

// Step 2 — verify the emailed code. On success the browser finishes sign-in.
export async function verifyLoginOtp(email: string, code: string) {
  const normalized = email.trim().toLowerCase();
  const entered = code.trim();
  if (!normalized || !entered) return { ok: false as const, error: "Enter the 6-digit code." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("email_otps")
    .select("id, code, expires_at")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { id: string; code: string; expires_at: string } | null;
  if (!row || row.code !== entered) return { ok: false as const, error: "Incorrect code. Check your email and try again." };
  if (new Date(row.expires_at) < new Date()) {
    await admin.from("email_otps").delete().eq("id", row.id);
    return { ok: false as const, error: "That code expired. Request a new one." };
  }

  await admin.from("email_otps").delete().eq("id", row.id);
  return { ok: true as const };
}

// ─── Password reset via our own Resend template ───────────────────────────
// Instead of letting Supabase Auth send the recovery email, we mint the
// recovery link with the admin API (generateLink) and send it ourselves with
// the editable `password_reset` template through Resend. The existing
// /auth/reset-password page consumes the link unchanged.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/**
 * Generate a Supabase recovery link for `email` and email it via our Resend
 * `password_reset` template. Returns the real outcome (caller decides what to
 * surface to the user).
 */
export async function sendPasswordResetEmail(opts: {
  email: string;
  /** Origin to return to (e.g. window.location.origin). Defaults to NEXT_PUBLIC_APP_URL. */
  redirectBase?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name")
    .ilike("email", email)
    .maybeSingle();
  const p = profile as { id: string; name: string | null } | null;

  const base = (opts.redirectBase || APP_URL || "").replace(/\/$/, "");
  const redirectTo = `${base}/auth/reset-password`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  const actionLink = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  if (error || !actionLink) {
    return { ok: false, error: error?.message ?? "Could not generate a reset link." };
  }

  const sent = await sendEmail({
    to: email,
    templateKey: "password_reset",
    recipientUserId: p?.id,
    href: "/auth/reset-password",
    variables: {
      name: p?.name ?? "there",
      reset_link: actionLink,
    },
  });
  if (!sent.ok) return { ok: false, error: sent.error ?? "Could not send the reset email." };
  return { ok: true };
}

/**
 * Public "Forgot password" entry. Always returns ok so it never reveals
 * whether an account exists for the given email.
 */
export async function requestPasswordReset(email: string, redirectBase?: string) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (normalized) {
    await sendPasswordResetEmail({ email: normalized, redirectBase }).catch(() => {});
  }
  return { ok: true as const };
}
