/**
 * BCJ Learn — database reset (clean slate)
 *
 * Wipes ALL operational data from the Supabase project and removes every auth
 * user, leaving an empty platform you can populate from scratch (invite the
 * first admin, build modules, etc.). It does NOT insert any data.
 *
 * Config singletons (branding_settings, reminder_rules) are left intact so the
 * app theme + reminder rules keep working.
 *
 * Run with:   npm run reset:db
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ⚠️  DESTRUCTIVE + IRREVERSIBLE. Runs against whatever project the env points
 *     to. Double-check NEXT_PUBLIC_SUPABASE_URL before running.
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

// Tables to clear, in FK-safe order (children → parents). `key` is a column
// that is guaranteed present + non-null on every row (a primary-key column),
// used to satisfy supabase-js's "delete needs a filter" safety rule.
const TABLES: { table: string; key: string }[] = [
  { table: "acknowledgements", key: "id" },
  { table: "content_views", key: "id" },
  { table: "video_progress", key: "manager_id" },
  { table: "email_otps", key: "id" },
  { table: "activity", key: "id" },
  { table: "notifications", key: "id" },
  { table: "attempt_answers", key: "attempt_id" },
  { table: "attempts", key: "id" },
  { table: "attendance", key: "id" },
  { table: "module_invitees", key: "delivery_id" },
  { table: "module_member_resets", key: "id" },
  { table: "module_resources", key: "module_slug" },
  { table: "question_options", key: "id" },
  { table: "question_versions", key: "id" },
  { table: "questions", key: "id" },
  { table: "module_content_versions", key: "id" },
  { table: "module_deliveries", key: "id" },
  { table: "lesson_contents", key: "id" },
  { table: "lessons", key: "id" },
  { table: "module_owners", key: "module_slug" },
  { table: "resources", key: "id" },
  { table: "modules", key: "slug" },
];

async function wipeTables() {
  console.log("\n🧹  Clearing tables…");
  for (const { table, key } of TABLES) {
    const { error } = await sb.from(table).delete().not(key, "is", null);
    if (error && !error.message.includes("does not exist")) {
      console.error(`   ✗ ${table}:`, error.message);
    } else {
      console.log(`   • cleared ${table}`);
    }
  }
}

async function wipeAuthUsers() {
  console.log("\n👤  Removing auth users (cascades to profiles)…");
  let removed = 0;
  // Page through all users (perPage max ~1000).
  // listUsers returns one page; loop until empty.
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("   ✗ listUsers:", error.message);
      break;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const { error: delErr } = await sb.auth.admin.deleteUser(u.id);
      if (delErr) console.error(`   ✗ delete ${u.email}:`, delErr.message);
      else removed++;
    }
    if (users.length < 1000) break;
  }
  console.log(`   ✓ removed ${removed} auth users`);
}

async function main() {
  console.log("🚀  BCJ Learn — database reset (clean slate)");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log("    ⚠️  This deletes ALL data + ALL users. Irreversible.");

  const t0 = Date.now();
  await wipeTables();
  await wipeAuthUsers();
  const seconds = Math.round((Date.now() - t0) / 1000);

  console.log(`\n✅  Reset complete in ${seconds}s — the platform is now empty.`);
  console.log("    Next: bootstrap the first admin (sign up via /login, then set");
  console.log("    profiles.role = 'admin' in Supabase Studio), then sign in.");
}

main().catch((err) => {
  console.error("\n💥  Reset failed:", err);
  process.exit(1);
});
