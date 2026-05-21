"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRoleStore } from "@/store/role-store";
import { allUsers as mockUsers } from "@/data/users";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  cohort: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  status: string | null;
  bio: string | null;
  title: string | null;
}

interface UseCurrentUserResult {
  user: CurrentUser | null;
  loading: boolean;
  /** True in demo mode (Zustand-backed, no real session). */
  isDemoMode: boolean;
}

/**
 * Returns the currently active user + profile.
 *
 *   • Demo mode  → reads role + authedUserId from Zustand role-store,
 *                  looks up the matching mock user from src/data/users.ts.
 *   • Production → subscribes to Supabase auth session, fetches the matching
 *                  profile from the `profiles` table.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const role = useRoleStore((s) => s.role);
  const authedUserId = useRoleStore((s) => s.authedUserId);

  const [supaUser, setSupaUser] = React.useState<CurrentUser | null>(null);
  const [loading, setLoading] = React.useState(!DEMO_MODE);

  React.useEffect(() => {
    if (DEMO_MODE) return;

    const supabase = createClient();
    let active = true;

    async function loadProfile(userId: string, email: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!active) return;

      if (error || !data) {
        setSupaUser(null);
        setLoading(false);
        return;
      }

      const row = data as Record<string, unknown>;
      setSupaUser({
        id: userId,
        name: (row.name as string) ?? email,
        email,
        role: (row.role as Role) ?? "manager",
        cohort: (row.cohort as string | null) ?? null,
        avatarColor: (row.avatar_color as string) ?? "#041D39",
        avatarUrl: (row.avatar_url as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        bio: (row.bio as string | null) ?? null,
        title: (row.title as string | null) ?? null,
      });
      setLoading(false);
    }

    // Initial session load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (user) {
        void loadProfile(user.id, user.email ?? "");
      } else {
        setSupaUser(null);
        setLoading(false);
      }
    });

    // Subscribe to auth state changes (sign-in / sign-out / token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        void loadProfile(session.user.id, session.user.email ?? "");
      } else {
        setSupaUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Demo-mode user — derived from the mock-data tables and the role-store.
  const demoUser = React.useMemo<CurrentUser | null>(() => {
    if (!DEMO_MODE) return null;
    const m = mockUsers.find((u) => u.id === authedUserId);
    if (!m) return null;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role,
      cohort: ("cohort" in m && typeof m.cohort === "string") ? m.cohort : null,
      avatarColor: m.avatarColor,
      avatarUrl: null,
      status: ("status" in m && typeof m.status === "string") ? m.status : null,
      bio: ("bio" in m && typeof m.bio === "string") ? m.bio : null,
      title: ("title" in m && typeof m.title === "string") ? m.title : null,
    };
  }, [authedUserId, role]);

  return {
    user: DEMO_MODE ? demoUser : supaUser,
    loading,
    isDemoMode: DEMO_MODE,
  };
}
