"use server";

// Branding + reminder-rules persistence. Both tables are singletons keyed
// by id='global'. Admin-only writes; RLS already enforces read-by-authed.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const p = data as { role?: Role } | null;
  if (!p || p.role !== "admin") return { ok: false, error: "Admin access required" };
  return { ok: true, userId: user.id };
}

export interface UpdateBrandingInput {
  name: string;
  primaryColor: string;
  accentColor: string;
  emailFrom: string;
  logoPath?: string | null;
}

export async function updateBrandingSettings(input: UpdateBrandingInput): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const HEX = /^#[0-9a-fA-F]{6}$/;
  if (!HEX.test(input.primaryColor.trim()) || !HEX.test(input.accentColor.trim())) {
    return { ok: false, error: "Colors must be 6-digit hex (e.g. #041D39)" };
  }
  if (input.emailFrom.trim() && !input.emailFrom.includes("@")) {
    return { ok: false, error: "Enter a valid sender email address" };
  }

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    primary_color: input.primaryColor.trim(),
    accent_color: input.accentColor.trim(),
    email_from: input.emailFrom.trim(),
    updated_by: guard.userId,
  };
  if (input.logoPath !== undefined) patch.logo_path = input.logoPath;

  const { error } = await admin.from("branding_settings").update(patch).eq("id", "global");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings/branding");
  return { ok: true };
}

export interface UpdateCertificateInput {
  heading: string;
  introLine: string;
  completionLine: string;
  orgName: string;
  footer: string;
  signatoryName: string;
  signatoryTitle: string;
  showLogo: boolean;
}

export async function updateCertificateSettings(input: UpdateCertificateInput): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!input.heading.trim()) return { ok: false, error: "Heading is required" };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("certificate_settings")
    .update({
      heading: input.heading.trim(),
      intro_line: input.introLine.trim(),
      completion_line: input.completionLine.trim(),
      org_name: input.orgName.trim(),
      footer: input.footer.trim(),
      signatory_name: input.signatoryName.trim(),
      signatory_title: input.signatoryTitle.trim(),
      show_logo: input.showLogo,
      updated_by: guard.userId,
    })
    .eq("id", "global");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/settings/certificate");
  return { ok: true };
}

export interface UpdateReminderRulesInput {
  autoReminders: boolean;
  overdueDays: number;
}

export async function updateReminderRules(input: UpdateReminderRulesInput): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (input.overdueDays < 1 || input.overdueDays > 30) {
    return { ok: false, error: "Threshold must be between 1 and 30 days" };
  }

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("reminder_rules")
    .update({
      auto_reminders: input.autoReminders,
      overdue_days: input.overdueDays,
      updated_by: guard.userId,
    })
    .eq("id", "global");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/notifications");
  return { ok: true };
}
