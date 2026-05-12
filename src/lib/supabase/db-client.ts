// Picks the right Supabase client for db/* queries based on mode.
//
//   • Demo mode → admin (service-role) client. Bypasses RLS so the demo
//     works regardless of which mock user the role-pick modal selected.
//   • Production → user-context server client. Reads cookies via @supabase/ssr
//     and honours RLS policies for the authenticated user.
//
// All src/lib/db/*.ts helpers call this instead of importing the server module
// directly, so the demo-vs-prod difference lives in exactly one place.

import { createClient, createAdminClient } from "@/lib/supabase/server";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function dbClient() {
  if (DEMO_MODE) return createAdminClient();
  return await createClient();
}
