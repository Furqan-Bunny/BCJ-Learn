// Vercel Cron endpoint — sends overdue training reminders.
//
// Scheduled in vercel.json. Secured by a bearer token (CRON_SECRET); Vercel
// Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
//
// "Overdue" = a manager invited to a module's current delivery whose
// scheduled_date is more than `overdue_days` in the past and who has not passed
// the quiz. Uses module_roster_view (migration 0004). De-duplicates against the
// notifications table so the daily cron never double-sends within ~20h.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getReminderRules } from "@/lib/db/settings";
import { sendEmail } from "@/lib/emails/send";

export const dynamic = "force-dynamic";

interface RosterRow {
  manager_id: string;
  name: string;
  email: string;
  module_slug: string;
  delivery_scheduled_date: string | null;
  latest_attempt_status: string | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await getReminderRules();
  if (!rules.autoReminders) {
    return NextResponse.json({ ok: true, skipped: "auto-reminders disabled", sent: 0 });
  }

  const admin = createAdminClient();

  // Candidate overdue rows from the current-delivery roster view.
  const { data: rosterData, error: rosterErr } = await admin
    .from("module_roster_view")
    .select("manager_id, name, email, module_slug, delivery_scheduled_date, latest_attempt_status");
  if (rosterErr) {
    return NextResponse.json({ error: rosterErr.message }, { status: 500 });
  }

  const now = Date.now();
  const overdueMs = rules.overdueDays * 24 * 60 * 60 * 1000;
  const candidates = ((rosterData ?? []) as RosterRow[]).filter((r) => {
    if (!r.delivery_scheduled_date || !r.email) return false;
    if (r.latest_attempt_status === "passed") return false;
    return new Date(r.delivery_scheduled_date).getTime() + overdueMs < now;
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, candidates: 0 });
  }

  // Dedup: anyone already reminded in the last ~20h is skipped.
  const since = new Date(now - 20 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("notifications")
    .select("recipient_id")
    .eq("kind", "reminder")
    .gt("sent_at", since);
  const remindedRecently = new Set(((recent ?? []) as { recipient_id: string }[]).map((n) => n.recipient_id));

  // Module titles for the email subject/body.
  const slugs = [...new Set(candidates.map((c) => c.module_slug))];
  const { data: mods } = await admin
    .from("modules")
    .select("slug, title")
    .in("slug", slugs);
  const titleBySlug = new Map(((mods ?? []) as { slug: string; title: string }[]).map((m) => [m.slug, m.title]));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let sent = 0;
  let skipped = 0;

  for (const c of candidates) {
    if (remindedRecently.has(c.manager_id)) {
      skipped++;
      continue;
    }
    const moduleTitle = titleBySlug.get(c.module_slug) ?? "your training module";
    const res = await sendEmail({
      to: c.email,
      templateKey: "overdue_reminder",
      recipientUserId: c.manager_id,
      href: `/manager/modules/${c.module_slug}`,
      variables: {
        name: c.name,
        module_title: moduleTitle,
        due_date: c.delivery_scheduled_date ?? "soon",
        quiz_link: `${appUrl}/manager/modules/${c.module_slug}/quiz`,
      },
    });
    if (res.ok) {
      sent++;
      // Mark locally so two overdue modules for the same person don't double-send this run.
      remindedRecently.add(c.manager_id);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, candidates: candidates.length });
}
