"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UpdateTemplateInput {
  key: string;
  subject: string;
  bodyMarkdown: string;
}

export async function updateEmailTemplate(
  input: UpdateTemplateInput,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Admin-only — RLS will reject otherwise, but explicit check gives a cleaner error.
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin access required" };
  }

  const { error } = await sb
    .from("email_templates")
    .update({
      subject: input.subject.trim(),
      body_markdown: input.bodyMarkdown,
      updated_by: user.id,
    })
    .eq("key", input.key);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/notifications");
  return { ok: true };
}
