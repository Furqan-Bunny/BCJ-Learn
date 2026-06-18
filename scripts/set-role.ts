/**
 * BCJ Learn — change ONE user's role (Employee / Department Lead / Admin)
 *
 * Quick fix for a mis-roled account (e.g. someone invited as an Employee who
 * should be a Department Lead). Updates profiles.role; the app reads role from
 * there, so the change takes effect on their next page load.
 *
 * Usage (run it yourself in the session shell):
 *   ! npx tsx scripts/set-role.ts ruth.bello@bcjbuildingservices.com teacher
 *   ! npx tsx scripts/set-role.ts someone@bcj.com manager|teacher|admin
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

const email = (process.argv[2] ?? "").trim().toLowerCase();
const role = (process.argv[3] ?? "").trim();

if (!email || !["manager", "teacher", "admin"].includes(role)) {
  console.error("Usage: npx tsx scripts/set-role.ts <email> <manager|teacher|admin>");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`🔧  Setting role of ${email} → ${role}`);
  const { data, error } = await sb
    .from("profiles")
    .update({ role })
    .ilike("email", email)
    .select("name, email, role, status");
  if (error) throw error;
  if (!data || data.length === 0) {
    console.error(`✗ No profile found for ${email}`);
    process.exit(1);
  }
  for (const p of data as { name: string; email: string; role: string; status: string }[]) {
    console.log(`✅  ${p.name} (${p.email}) is now role=${p.role}, status=${p.status}`);
  }
  console.log("\n    They'll get the right experience on their next page load.");
}

main().catch((err) => {
  console.error("\n💥  Failed:", err.message ?? err);
  process.exit(1);
});
