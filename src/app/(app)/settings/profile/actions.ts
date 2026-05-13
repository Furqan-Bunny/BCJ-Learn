"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
}

export async function updateProfile(input: UpdateProfileInput) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const updates: Record<string, unknown> = {};
  if (typeof input.name === "string" && input.name.trim()) {
    const trimmed = input.name.trim();
    // Reject leading spreadsheet-formula characters so a poisoned name can't be
    // used for CSV-injection against admins exporting reports.
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return { ok: false, error: "Name can't start with =, +, -, @ or a tab" };
    }
    updates.name = trimmed;
  }
  if (typeof input.bio === "string") updates.bio = input.bio;
  if (typeof input.timezone === "string") updates.timezone = input.timezone;
  if (typeof input.locale === "string") updates.locale = input.locale;

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
