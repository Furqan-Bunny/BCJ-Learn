"use server";

// Reminder + test-email server actions. Wraps `sendEmail()` for the
// overdue_reminder template and exposes a "Send test" action for admins.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail, type TemplateKey } from "@/lib/emails/send";
import { buildSampleVars } from "@/lib/emails/sample-vars";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface Guard {
  ok: true;
  userId: string;
  userName: string;
  userEmail: string;
}
type GuardResult = Guard | { ok: false; error: string };

async function requireAdmin(): Promise<GuardResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await sb.from("profiles").select("role, name, email").eq("id", user.id).single();
  const p = data as { role?: Role; name?: string; email?: string } | null;
  if (!p || p.role !== "admin") return { ok: false, error: "Admin access required" };
  return { ok: true, userId: user.id, userName: p.name ?? "", userEmail: p.email ?? user.email ?? "" };
}

export async function sendReminder(managerId: string, moduleSlug?: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", managerId)
    .single();
  if (!target) return { ok: false, error: "Recipient not found" };
  const { name, email } = target as { name: string; email: string };

  let moduleTitle = "your upcoming module";
  let quizLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/manager/dashboard`;
  let dueDate = "soon";
  if (moduleSlug) {
    const { data: mod } = await admin
      .from("modules")
      .select("title, scheduled_date")
      .eq("slug", moduleSlug)
      .single();
    if (mod) {
      const m = mod as { title: string; scheduled_date: string | null };
      moduleTitle = m.title;
      dueDate = m.scheduled_date ?? dueDate;
      quizLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/manager/modules/${moduleSlug}/quiz`;
    }
  }

  if (DEMO_MODE) {
    return { ok: true };
  }

  const res = await sendEmail({
    to: email,
    templateKey: "overdue_reminder",
    recipientUserId: managerId,
    href: moduleSlug ? `/manager/modules/${moduleSlug}` : "/manager/dashboard",
    variables: { name, module_title: moduleTitle, due_date: dueDate, quiz_link: quizLink },
  });
  if (!res.ok) return { ok: false, error: res.error };

  await admin.from("activity").insert({
    kind: "reminder_sent",
    actor_id: guard.userId,
    target_id: managerId,
    message: `${guard.userName} sent a reminder to ${name}${moduleSlug ? ` re: ${moduleTitle}` : ""}`,
  });

  revalidatePath("/admin/notifications");
  return { ok: true };
}

export async function sendBulkReminders(
  managerIds: string[],
  moduleSlug?: string,
): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, sent: 0, failed: 0, error: guard.error };

  let sent = 0;
  let failed = 0;
  for (const id of managerIds) {
    const r = await sendReminder(id, moduleSlug);
    if (r.ok) sent++;
    else failed++;
  }
  return { ok: true, sent, failed };
}

export async function sendTestEmail(templateKey: TemplateKey): Promise<{ ok: boolean; error?: string; to?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.userEmail) return { ok: false, error: "Could not determine your email address" };

  const res = await sendEmail({
    to: guard.userEmail,
    templateKey,
    recipientUserId: guard.userId,
    variables: buildSampleVars({
      name: guard.userName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, to: guard.userEmail };
}
