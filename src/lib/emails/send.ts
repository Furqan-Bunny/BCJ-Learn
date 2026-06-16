// Send an email by template key — looks up the editable template from the DB,
// substitutes {{var}} placeholders, renders markdown to HTML, and dispatches
// via Resend. Also logs the send to the `notifications` table so it shows up
// in the admin Recent sends list.
//
// Demo mode short-circuits — just logs to the notifications table without
// actually hitting Resend (so the demo doesn't send real email).

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { resendClient, resendFromAddress } from "./resend-client";
import { renderMarkdown, substituteVars } from "./render";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// The built-in template keys. Custom (admin-created) templates are also allowed
// — sendEmail accepts any string key (TemplateKey | string), and custom keys
// resolve their notification kind from the template row's notification_kind.
export type TemplateKey =
  | "invite"
  | "password_reset"
  | "welcome"
  | "quiz_passed"
  | "quiz_failed"
  | "overdue_reminder"
  | "at_risk_alert"
  | "login_code"
  | "seminar_scheduled"
  | "seminar_rescheduled";

// Maps a template to the notification_kind enum on `notifications`. Built-ins are
// mapped by key; custom templates fall back to their stored kind, else 'reminder'.
function notificationKindFor(template: string, customKind?: string | null): "invitation" | "reminder" | "result" | "alert" {
  if (template === "invite" || template === "welcome") return "invitation";
  if (template === "overdue_reminder" || template === "password_reset" || template === "seminar_scheduled" || template === "seminar_rescheduled") return "reminder";
  if (template === "quiz_passed" || template === "quiz_failed") return "result";
  if (template === "at_risk_alert" || template === "login_code") return "alert";
  if (customKind === "invitation" || customKind === "reminder" || customKind === "result" || customKind === "alert") return customKind;
  return "reminder";
}

export interface SendEmailInput {
  to: string | string[];
  /** A built-in TemplateKey or a custom template key (any string). */
  templateKey: TemplateKey | string;
  variables: Record<string, string>;
  /** Optional override; if omitted we look up by templateKey from `email_templates`. */
  recipientUserId?: string;
  /** Optional deep link persisted on the notification row for in-app click-through. */
  href?: string | null;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

// Map opt-outable templates to a key in `profiles.notification_prefs`.
// Transactional templates (invite, password_reset, welcome) are absent — the
// gate is a no-op for them, so they always send.
const PREF_KEY_BY_TEMPLATE: Record<string, "quiz_results" | "training_reminders" | "at_risk_alerts"> = {
  quiz_passed:      "quiz_results",
  quiz_failed:      "quiz_results",
  overdue_reminder: "training_reminders",
  at_risk_alert:    "at_risk_alerts",
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const admin = createAdminClient();

  // 0. Respect recipient notification preferences for opt-outable templates.
  //    Missing key → opted-in. Explicit `false` → skip send + skip log.
  const prefKey = PREF_KEY_BY_TEMPLATE[input.templateKey];
  if (prefKey && input.recipientUserId) {
    const { data: prefRow } = await admin
      .from("profiles")
      .select("notification_prefs")
      .eq("id", input.recipientUserId)
      .maybeSingle();
    const prefs = ((prefRow as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs ?? {}) as Record<string, boolean>;
    if (prefs[prefKey] === false) {
      return { ok: true, messageId: "opted_out" };
    }
  }

  // 1. Look up the editable template.
  const { data: templateRow, error: templateErr } = await admin
    .from("email_templates")
    .select("subject, body_markdown, notification_kind")
    .eq("key", input.templateKey)
    .maybeSingle();

  if (templateErr || !templateRow) {
    return { ok: false, error: `Template "${input.templateKey}" not found in DB` };
  }
  const tpl = templateRow as { subject: string; body_markdown: string; notification_kind?: string | null };

  // 2. Substitute vars in subject + body, then render body as HTML.
  const subject = substituteVars(tpl.subject, input.variables);
  const bodyMd = substituteVars(tpl.body_markdown, input.variables);
  const bodyHtml = renderMarkdown(bodyMd);
  const preview = bodyMd.replace(/[#*_>`-]/g, "").trim().slice(0, 140);

  // 3. Log to notifications table so it shows up in the admin Recent sends UI
  //    and in the recipient's in-app bell.
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (input.recipientUserId) {
    await admin.from("notifications").insert({
      kind: notificationKindFor(input.templateKey, tpl.notification_kind),
      recipient_id: input.recipientUserId,
      subject,
      preview,
      body: bodyHtml,
      href: input.href ?? null,
    });
  }

  // 4. Demo mode: do not actually send.
  if (DEMO_MODE) {
    return { ok: true, messageId: "demo-mode" };
  }

  // 5. Send via Resend.
  try {
    const client = resendClient();
    const { data, error } = await client.emails.send({
      from: await resendFromAddress(),
      to: recipients,
      subject,
      html: bodyHtml,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
