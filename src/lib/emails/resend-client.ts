// Thin Resend wrapper. RESEND_API_KEY and RESEND_FROM_EMAIL must be set on
// the server. The actual Resend account can be Ten80Ten's during build and
// BCJ's at launch — the swap is just an env-var change.

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";

let cached: Resend | null = null;

export function resendClient(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (local) or Vercel project env (prod).",
    );
  }
  cached = new Resend(key);
  return cached;
}

// The "from" address. Prefers the admin-configured branding_settings.email_from
// (formatted as "Brand Name <email>"), then the RESEND_FROM_EMAIL env, then a
// default. NOTE: the chosen domain must be verified on Resend or sends fail.
export async function resendFromAddress(): Promise<string> {
  const envFrom = process.env.RESEND_FROM_EMAIL;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("branding_settings")
      .select("email_from, name")
      .eq("id", "global")
      .maybeSingle();
    const row = data as { email_from?: string; name?: string } | null;
    const email = row?.email_from?.trim();
    if (email && email.includes("@")) {
      if (email.includes("<")) return email; // already "Name <email>"
      const name = row?.name?.trim() || "BCJ Learn";
      return `${name} <${email}>`;
    }
  } catch {
    // fall through to env / default
  }
  return envFrom ?? "BCJ Learn <noreply@app.bcjbuildingservices.com>";
}
