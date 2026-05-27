"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface NotificationPrefsInput {
  quizResults?: boolean;
  trainingReminders?: boolean;
  atRiskAlerts?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  /** Pass `null` or empty string to clear. */
  phone?: string | null;
  notificationPrefs?: NotificationPrefsInput;
  twoFactorEnabled?: boolean;
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PHONE_PATTERN = /^[+\d][\d\s()\-]{6,19}$/;

export async function updateProfile(input: UpdateProfileInput) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const updates: Record<string, unknown> = {};

  if (typeof input.name === "string" && input.name.trim()) {
    const trimmed = input.name.trim();
    if (FORMULA_PREFIX.test(trimmed)) {
      return { ok: false, error: "Name can't start with =, +, -, @ or a tab" };
    }
    updates.name = trimmed;
  }
  if (typeof input.bio === "string") updates.bio = input.bio;
  if (typeof input.timezone === "string") updates.timezone = input.timezone;
  if (typeof input.locale === "string") updates.locale = input.locale;
  if (typeof input.twoFactorEnabled === "boolean") updates.two_factor_enabled = input.twoFactorEnabled;

  // Phone — null/empty clears; otherwise trim, defang, regex-validate.
  if (input.phone !== undefined) {
    if (input.phone === null || input.phone.trim() === "") {
      updates.phone = null;
    } else {
      const trimmed = input.phone.trim();
      if (FORMULA_PREFIX.test(trimmed)) {
        return { ok: false, error: "Phone can't start with =, +, -, @ or a tab. Use + only with a country code (e.g. +1...)." };
      }
      if (!PHONE_PATTERN.test(trimmed)) {
        return { ok: false, error: "Phone format looks off. Try +14155552671 or (415) 555-2671." };
      }
      updates.phone = trimmed;
    }
  }

  // Notification prefs — merge incoming keys into existing row.
  if (input.notificationPrefs) {
    const { data: row } = await sb
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user.id)
      .maybeSingle();
    const current = ((row as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs ?? {
      quiz_results: true,
      training_reminders: true,
      at_risk_alerts: true,
    }) as Record<string, boolean>;

    const next = { ...current };
    if (typeof input.notificationPrefs.quizResults === "boolean") next.quiz_results = input.notificationPrefs.quizResults;
    if (typeof input.notificationPrefs.trainingReminders === "boolean") next.training_reminders = input.notificationPrefs.trainingReminders;
    if (typeof input.notificationPrefs.atRiskAlerts === "boolean") next.at_risk_alerts = input.notificationPrefs.atRiskAlerts;
    updates.notification_prefs = next;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await sb.from("profiles").update(updates).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout"); // user-menu / sidebar may show name/avatar
  return { ok: true };
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordInput) {
  if (input.newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in" };

  // Verify current password
  const { error: verifyErr } = await sb.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (verifyErr) return { ok: false, error: "Current password is incorrect" };

  // Set new password
  const { error: updateErr } = await sb.auth.updateUser({ password: input.newPassword });
  if (updateErr) return { ok: false, error: updateErr.message };

  return { ok: true };
}

export async function signOutEverywhere() {
  const sb = await createClient();
  const { error } = await sb.auth.signOut({ scope: "global" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
