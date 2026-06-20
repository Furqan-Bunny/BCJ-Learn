/**
 * BCJ Learn — temporary data setup for refreshing the guide screenshots.
 *
 * The screenshot capture logs in as the test accounts. For the Department-Lead
 * screens to look populated, the test lead needs to OWN a module. This makes
 * `test-lead@bcjbuildingservices.com` a co-owner of the throwaway "test" module
 * (NOT HR) so lead dashboard / my-team / content / questions screens fill in.
 *
 * Run it yourself in the session shell:
 *   ! npx tsx scripts/screenshot-setup.ts            # set up
 *   ! npx tsx scripts/screenshot-setup.ts --teardown # undo (remove ownership)
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const LEAD_EMAIL = "test-lead@bcjbuildingservices.com";
const MODULE_SLUG = "test";
const teardown = process.argv.includes("--teardown");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: lead, error: lErr } = await sb
    .from("profiles").select("id, name").eq("email", LEAD_EMAIL).maybeSingle();
  if (lErr) throw lErr;
  if (!lead) { console.error(`✗ ${LEAD_EMAIL} not found.`); process.exit(1); }
  const leadId = (lead as { id: string; name: string }).id;

  if (teardown) {
    const { error } = await sb
      .from("module_owners").delete().eq("module_slug", MODULE_SLUG).eq("teacher_id", leadId);
    if (error) throw error;
    console.log(`✅  Removed ${LEAD_EMAIL} as owner of "${MODULE_SLUG}". Screenshot setup undone.`);
    return;
  }

  const { error } = await sb
    .from("module_owners")
    .upsert({ module_slug: MODULE_SLUG, teacher_id: leadId }, { onConflict: "module_slug,teacher_id" });
  if (error) throw error;
  console.log(`✅  ${LEAD_EMAIL} now co-owns "${MODULE_SLUG}" (temporary, for screenshots).`);
  console.log(`    Run with --teardown afterwards to remove it.`);
}

main().catch((err) => { console.error("\n💥  Failed:", err.message ?? err); process.exit(1); });
