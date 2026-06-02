/**
 * BCJ Learn — create users directly (no invite email)
 *
 * Creates auth users with a known password + sets their profile role/title/etc,
 * so they can sign in immediately. No emails are sent. Idempotent: if a user
 * already exists, their password + profile fields are updated.
 *
 * Run with:   npx tsx scripts/create-users.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "BcjLearnDemo2026!";

type Role = "admin" | "teacher" | "manager";

interface NewUser {
  email: string;
  name: string;
  role: Role;
  title?: string;
  cohort?: "Georgia" | "Tennessee" | "North Carolina";
  status?: "active";
}

const USERS: NewUser[] = [
  // ── 3 test users (one per role) ──────────────────────────────
  { email: "testadmin@bcj.com", name: "Test Admin", role: "admin", title: "Test Administrator" },
  { email: "testlead@bcj.com", name: "Test Lead", role: "teacher", title: "Test Department Lead" },
  { email: "testemployee@bcj.com", name: "Test Employee", role: "manager", cohort: "Georgia", status: "active" },

  // ── Real admins (from the roster PDF; no Majed) ──────────────
  { email: "nancy@bcj.com", name: "Nancy McMinn", role: "admin", title: "Chief of Staff" },
  { email: "isabel@bcj.com", name: "Isabel Romo", role: "admin", title: "VP Operations" },
  { email: "andres.cadena@bcj.com", name: "Andres Cadena", role: "admin", title: "Director of Operations" },
  { email: "karen.merizalde@bcj.com", name: "Karen Merizalde", role: "admin", title: "Account Manager" },
];

async function findUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 1000) return null;
  }
}

async function upsertUser(u: NewUser): Promise<void> {
  // 1) Create the auth user (trigger handle_new_user creates the profile row
  //    with role from user_metadata). If it already exists, update password.
  let userId: string | null = null;

  const { data, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: u.name, role: u.role },
  });

  if (data?.user) {
    userId = data.user.id;
  } else if (error?.message?.toLowerCase().includes("already")) {
    userId = await findUserByEmail(u.email);
    if (userId) {
      await sb.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        user_metadata: { name: u.name, role: u.role },
      });
    }
  }

  if (!userId) {
    console.error(`   ✗ ${u.email}: ${error?.message ?? "could not create"}`);
    return;
  }

  // 2) Set profile fields. Role is set so a re-run also corrects it.
  const patch: Record<string, unknown> = {
    name: u.name,
    role: u.role,
    title: u.title ?? null,
    status: u.status ?? null,
    last_active_at: new Date().toISOString(),
  };
  if (u.cohort) patch.cohort = u.cohort;

  const { error: pErr } = await sb.from("profiles").update(patch).eq("id", userId);
  if (pErr) {
    console.error(`   ✗ ${u.email} profile: ${pErr.message}`);
    return;
  }

  console.log(`   ✓ ${u.role.padEnd(7)} ${u.email}  (${u.name})`);
}

async function main() {
  console.log("👥  BCJ Learn — creating users (no email sent)");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log(`    Password for all: ${PASSWORD}\n`);

  for (const u of USERS) {
    await upsertUser(u);
  }

  console.log(`\n✅  Done — ${USERS.length} users ready. Sign in with the password above.`);
}

main().catch((err) => {
  console.error("\n💥  create-users failed:", err);
  process.exit(1);
});
