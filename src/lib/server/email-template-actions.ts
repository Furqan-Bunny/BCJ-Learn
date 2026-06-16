"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/emails/send";
import type { Role } from "@/types";

// Resolve the signed-in admin (explicit check gives a cleaner error than RLS).
async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin access required" };
  }
  return { ok: true, userId: user.id };
}

export interface UpdateTemplateInput {
  key: string;
  subject: string;
  bodyMarkdown: string;
  /** Friendly display name (custom templates only). */
  label?: string;
}

export async function updateEmailTemplate(
  input: UpdateTemplateInput,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const sb = await createClient();

  const { error } = await sb
    .from("email_templates")
    .update({
      subject: input.subject.trim(),
      body_markdown: input.bodyMarkdown,
      ...(input.label !== undefined ? { label: input.label.trim() || null } : {}),
      updated_by: guard.userId,
    })
    .eq("key", input.key);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/notifications");
  return { ok: true };
}

type NotificationKind = "invitation" | "reminder" | "result" | "alert";

export interface CreateTemplateInput {
  label: string;
  subject: string;
  bodyMarkdown: string;
  variables?: string[];
  notificationKind?: NotificationKind;
}

// Create a NEW admin-authored email template. The key is derived from the label
// with a short unique suffix and prefixed `custom_` so it never collides with a
// built-in key. RLS already restricts email_templates writes to admins.
export async function createEmailTemplate(
  input: CreateTemplateInput,
): Promise<{ ok: boolean; error?: string; key?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!input.label.trim() || !input.subject.trim()) {
    return { ok: false, error: "A label and subject are required." };
  }

  const slug = input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "template";
  const key = `custom_${slug}_${Date.now().toString(36).slice(-4)}`;

  const sb = await createClient();
  const { error } = await sb.from("email_templates").insert({
    key,
    subject: input.subject.trim(),
    body_markdown: input.bodyMarkdown,
    variables: input.variables ?? [],
    is_custom: true,
    label: input.label.trim(),
    notification_kind: input.notificationKind ?? "reminder",
    updated_by: guard.userId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/notifications");
  return { ok: true, key };
}

// Delete a custom template. Built-in templates (is_custom = false) are protected.
export async function deleteEmailTemplate(key: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const sb = await createClient();

  const { data: row } = await sb.from("email_templates").select("is_custom").eq("key", key).maybeSingle();
  if (!row) return { ok: false, error: "Template not found" };
  if (!(row as { is_custom?: boolean }).is_custom) {
    return { ok: false, error: "Built-in templates can't be deleted." };
  }

  const { error } = await sb.from("email_templates").delete().eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/notifications");
  return { ok: true };
}

export type SendAudience =
  | { all: true }
  | { role: Role }
  | { market: string }
  | { userIds: string[] };

// Manually send a (usually custom) template to a chosen audience, right now.
// The automatic "when to send" trigger engine is a later phase — this is the
// immediate ad-hoc send. Returns how many were emailed.
export async function sendCustomEmail(
  key: string,
  audience: SendAudience,
): Promise<{ ok: boolean; error?: string; sent?: number }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  let q = admin.from("profiles").select("id, name, email");
  if ("userIds" in audience) {
    if (audience.userIds.length === 0) return { ok: false, error: "No recipients selected." };
    q = q.in("id", audience.userIds);
  } else if ("role" in audience) {
    q = q.eq("role", audience.role);
  } else if ("market" in audience) {
    q = q.contains("markets", [audience.market]);
  }
  // "all" → no extra filter.
  const { data: people, error: peopleErr } = await q;
  if (peopleErr) return { ok: false, error: peopleErr.message };
  const recipients = ((people ?? []) as { id: string; name: string; email: string }[]).filter((p) => p.email);
  if (recipients.length === 0) return { ok: false, error: "No recipients matched." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const results = await Promise.all(
    recipients.map((p) =>
      sendEmail({
        to: p.email,
        templateKey: key,
        recipientUserId: p.id,
        href: "/notifications",
        variables: { name: p.name ?? "there", app_url: appUrl, login_link: `${appUrl}/login` },
      })
        .then((r) => r.ok)
        .catch(() => false),
    ),
  );
  return { ok: true, sent: results.filter(Boolean).length };
}
