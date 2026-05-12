// Server-side current user resolution.
//
// In demo mode we fall back to a deterministic mock user (Luke, the first
// seeded manager) so server components render without a real Supabase
// session. In production we read the cookie-bound auth session and look
// up the corresponding profile row.

import { createClient } from "@/lib/supabase/server";
import { managers as mockManagers, teachers as mockTeachers, admins as mockAdmins } from "@/data/users";
import type { Role, Cohort, ManagerStatus } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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
  if (DEMO_MODE) {
    const m = mockManagers[0];
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: "manager",
      cohort: m.cohort,
      avatarColor: m.avatarColor,
      avatarUrl: null,
      status: m.status,
      bio: null,
      title: null,
    };
  }

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
 * Resolve a demo-mode user by role. Useful for pages that always need a
 * specific role of mock user (e.g. teacher pages should default to a
 * teacher, not a manager).
 */
export async function getCurrentUserForRole(role: Role): Promise<CurrentUser | null> {
  if (DEMO_MODE) {
    if (role === "manager") {
      const m = mockManagers[0];
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: "manager",
        cohort: m.cohort,
        avatarColor: m.avatarColor,
        avatarUrl: null,
        status: m.status,
        bio: null,
        title: null,
      };
    }
    if (role === "teacher") {
      const t = mockTeachers[0];
      return {
        id: t.id,
        name: t.name,
        email: t.email,
        role: "teacher",
        cohort: null,
        avatarColor: t.avatarColor,
        avatarUrl: null,
        status: null,
        bio: t.bio,
        title: null,
      };
    }
    const a = mockAdmins[0];
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      role: "admin",
      cohort: null,
      avatarColor: a.avatarColor,
      avatarUrl: null,
      status: null,
      bio: null,
      title: a.title,
    };
  }
  return getCurrentUser();
}
