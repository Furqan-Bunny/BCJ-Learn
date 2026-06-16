/**
 * BCJ Learn — create ONE manager (test employee account)
 *
 * Creates a single active manager (employee) you can sign in with immediately —
 * handy for a dry-run: assign them to a module, take the seminar quiz, see the
 * pass/fail + retake flow. Idempotent: if the email already exists, it just
 * resets that user's password + ensures role=manager/active.
 *
 * Usage (run it yourself in the session shell):
 *   ! npx tsx scripts/create-manager.ts
 *   ! npx tsx scripts/create-manager.ts shirley@bcjbuildingservices.com YourPass123! "Shirley" Atlanta
 *
 * Args: [email] [password] [name] [market]
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

const email = process.argv[2] ?? "test-manager@bcjbuildingservices.com";
const password = process.argv[3] ?? "BcjLearnDemo2026!";
const name = process.argv[4] ?? "Test Manager";
const market = process.argv[5] ?? "Atlanta"; // Atlanta | Nashville | Charlotte

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
  console.log("🚀  BCJ Learn — create manager (test employee)");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log(`    Email:   ${email}`);

  let userId: string | null = null;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "manager" },
  });

  if (error) {
    // Likely already exists → update password instead.
    console.log(`   • createUser said: ${error.message} — trying to update the existing user…`);
    userId = await findUserByEmail(email);
    if (!userId) throw new Error(`Could not create or find user ${email}`);
    const { error: pwErr } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name, role: "manager" },
    });
    if (pwErr) throw pwErr;
  } else {
    userId = data.user!.id;
  }

  // Ensure the profile row is an active manager with a market (the
  // handle_new_user trigger seeds role from metadata; we set the rest explicitly).
  const { error: profErr } = await sb
    .from("profiles")
    .update({
      name,
      role: "manager",
      status: "active",
      markets: [market],
      cohort: market,
      invite_token: null,
    })
    .eq("id", userId);
  if (profErr) throw profErr;

  console.log("\n✅  Manager ready. Sign in at /login with:");
  console.log(`    Email:    ${email}`);
  console.log(`    Password: ${password}`);
  console.log(`    Market:   ${market}`);
  console.log("\n    Next: as an admin, open a module → Roster → add this employee, schedule the seminar,");
  console.log("    then sign in as them to take the quiz end-to-end.");
}

main().catch((err) => {
  console.error("\n💥  Failed:", err.message ?? err);
  process.exit(1);
});
