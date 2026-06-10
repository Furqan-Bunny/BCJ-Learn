/**
 * BCJ Learn — create ONE admin (bootstrap account)
 *
 * Creates a single active admin you can sign in with immediately, so you can
 * then invite the real users from the admin UI. Idempotent: if the email already
 * exists, it just resets that user's password + ensures role=admin/active.
 *
 * Usage (run it yourself in the session shell):
 *   ! npx tsx scripts/create-admin.ts
 *   ! npx tsx scripts/create-admin.ts you@bcjbuildingservices.com YourPass123! "Your Name"
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Runs against whatever project the env points to — double-check the URL below.
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

const email = process.argv[2] ?? "test-admin@bcjbuildingservices.com";
const password = process.argv[3] ?? "BcjLearnDemo2026!";
const name = process.argv[4] ?? "Test Admin";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 1000) return null;
  }
}

async function main() {
  console.log("🚀  BCJ Learn — create admin");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log(`    Email:   ${email}`);

  let userId: string | null = null;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "admin" },
  });

  if (error) {
    // Likely already exists → update password instead.
    console.log(`   • createUser said: ${error.message} — trying to update the existing user…`);
    userId = await findUserByEmail(email);
    if (!userId) throw new Error(`Could not create or find user ${email}`);
    const { error: pwErr } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name, role: "admin" },
    });
    if (pwErr) throw pwErr;
  } else {
    userId = data.user!.id;
  }

  // Ensure the profile row is admin + active (the handle_new_user trigger seeds
  // role from metadata, but we set it explicitly to be safe).
  const { error: profErr } = await sb
    .from("profiles")
    .update({ name, role: "admin", status: "active", invite_token: null })
    .eq("id", userId);
  if (profErr) throw profErr;

  console.log("\n✅  Admin ready. Sign in at /login with:");
  console.log(`    Email:    ${email}`);
  console.log(`    Password: ${password}`);
  console.log("\n    Next: log in → People → invite the real users (admins / leads).");
}

main().catch((err) => {
  console.error("\n💥  Failed:", err.message ?? err);
  process.exit(1);
});
