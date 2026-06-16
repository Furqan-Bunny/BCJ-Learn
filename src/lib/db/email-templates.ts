// Email templates — editable subject/body rows backing sendEmail().
// Admins manage these from /admin/notifications.

import { dbClient } from "@/lib/supabase/db-client";

export interface EmailTemplateRow {
  key: string;
  subject: string;
  bodyMarkdown: string;
  variables: string[];
  updatedAt: string | null;
  isCustom: boolean;
  label: string | null;
  notificationKind: string | null;
}

interface Row {
  key: string;
  subject: string;
  body_markdown: string;
  variables: unknown;
  updated_at: string | null;
  is_custom: boolean | null;
  label: string | null;
  notification_kind: string | null;
}

const COLS = "key, subject, body_markdown, variables, updated_at, is_custom, label, notification_kind";

function mapRow(r: Row): EmailTemplateRow {
  return {
    key: r.key,
    subject: r.subject,
    bodyMarkdown: r.body_markdown,
    variables: Array.isArray(r.variables) ? (r.variables as string[]) : [],
    updatedAt: r.updated_at,
    isCustom: !!r.is_custom,
    label: r.label,
    notificationKind: r.notification_kind,
  };
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("email_templates")
    .select(COLS)
    .order("key");

  return ((data ?? []) as Row[]).map(mapRow);
}

export async function getEmailTemplate(key: string): Promise<EmailTemplateRow | null> {
  const sb = await dbClient();
  const { data } = await sb
    .from("email_templates")
    .select(COLS)
    .eq("key", key)
    .maybeSingle();
  return data ? mapRow(data as Row) : null;
}
