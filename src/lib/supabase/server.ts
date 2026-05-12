// Server-side Supabase client (cookie-bound).
// Use this inside Server Components, Route Handlers, and Server Actions.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `set` throws when called from a Server Component (read-only).
            // Safe to ignore — middleware refreshes the session.
          }
        },
      },
    },
  );
}

// Admin client — uses the service-role key. NEVER expose to the browser.
// Use only in trusted server contexts (Server Actions, Route Handlers, cron jobs)
// for operations like inviting users or bypassing RLS.
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createAdminSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
