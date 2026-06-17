/**
 * BCJ Learn — create ONE Department Lead (test / bootstrap account)
 *
 * Creates a single active Department Lead (role=teacher) you can sign in with
 * immediately — no invite email needed. Idempotent: if the email already exists,
 * it just resets that user's password + ensures role=teacher/active.
 *
 * Usage (run it yourself in the session shell):
 *   ! npx tsx scripts/create-lead.ts
 *   ! npx tsx scripts/create-lead.ts lead@bcjbuildingservices.com YourPass123! "Lead Name"
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

const email = process.argv[2] ?? "test-lead@bcjbuildingservices.com";
const password = process.argv[3] ?? "BcjLearnDemo2026!";
const name = process.argv[4] ?? "Test Lead";

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
  console.log("🚀  BCJ Learn — create Department Lead");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log(`    Email:   ${email}`);

  let userId: string | null = null;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "teacher" },
  });

  if (error) {
    // Likely already exists → update password instead.
    console.log(`   • createUser said: ${error.message} — trying to update the existing user…`);
    userId = await findUserByEmail(email);
    if (!userId) throw new Error(`Could not create or find user ${email}`);
    const { error: pwErr } = await sb.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name, role: "teacher" },
    });
    if (pwErr) throw pwErr;
  } else {
    userId = data.user!.id;
  }

  // Ensure the profile row is teacher (Department Lead) + active. The
  // handle_new_user trigger seeds role from metadata, but set it explicitly.
  const { error: profErr } = await sb
    .from("profiles")
    .update({ name, role: "teacher", status: "active", invite_token: null })
    .eq("id", userId);
  if (profErr) throw profErr;

  console.log("\n✅  Department Lead ready. Sign in at /login with:");
  console.log(`    Email:    ${email}`);
  console.log(`    Password: ${password}`);
  console.log("\n    They'll land on the Department Lead dashboard. Leads can present /");
  console.log("    preview any module; to give edit controls on a specific module, set");
  console.log("    them as an owner from the admin module page.");
}

main().catch((err) => {
  console.error("\n💥  Failed:", err.message ?? err);
  process.exit(1);
});
