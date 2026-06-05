// Email templates — editable subject/body rows backing sendEmail().
// Admins manage these from /admin/notifications.

import { dbClient } from "@/lib/supabase/db-client";

export interface EmailTemplateRow {
  key: string;
  subject: string;
  bodyMarkdown: string;
  variables: string[];
  updatedAt: string | null;
}

interface Row {
  key: string;
  subject: string;
  body_markdown: string;
  variables: unknown;
  updated_at: string | null;
}

function mapRow(r: Row): EmailTemplateRow {
  return {
    key: r.key,
    subject: r.subject,
    bodyMarkdown: r.body_markdown,
    variables: Array.isArray(r.variables) ? (r.variables as string[]) : [],
    updatedAt: r.updated_at,
  };
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("email_templates")
    .select("key, subject, body_markdown, variables, updated_at")
    .order("key");

  return ((data ?? []) as Row[]).map(mapRow);
}

export async function getEmailTemplate(key: string): Promise<EmailTemplateRow | null> {
  const sb = await dbClient();
  const { data } = await sb
    .from("email_templates")
    .select("key, subject, body_markdown, variables, updated_at")
    .eq("key", key)
    .maybeSingle();
  return data ? mapRow(data as Row) : null;
}
