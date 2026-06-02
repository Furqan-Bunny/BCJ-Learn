// Server-side current user resolution.
//
// Reads the cookie-bound auth session and looks up the corresponding profile
// row in `profiles`.

import { createClient } from "@/lib/supabase/server";
import type { Role, Cohort, ManagerStatus } from "@/types";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  cohort: Cohort | null;
  avatarColor: string;
  avatarUrl: string | null;
  status: ManagerStatus | null;
  bio: string | null;
  title: string | null;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  cohort: Cohort | null;
  avatar_color: string;
  avatar_url: string | null;
  status: ManagerStatus | null;
  bio: string | null;
  title: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!data) return null;

  const r = data as ProfileRow;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    cohort: r.cohort,
    avatarColor: r.avatar_color,
    avatarUrl: r.avatar_url,
    status: r.status,
    bio: r.bio,
    title: r.title,
  };
}

/**
 * Resolve the current user. The `role` argument is accepted for call-site
 * clarity (e.g. teacher pages pass "teacher") but the real role always comes
 * from the authenticated profile.
 */
export async function getCurrentUserForRole(_role: Role): Promise<CurrentUser | null> {
  return getCurrentUser();
}
