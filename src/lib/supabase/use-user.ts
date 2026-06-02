"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
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
  /** Kept for callers that branch on it; always false now that mock data is gone. */
  isDemoMode: boolean;
}

/**
 * Returns the currently active user + profile by subscribing to the Supabase
 * auth session and fetching the matching `profiles` row.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
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
        setUser(null);
        setLoading(false);
        return;
      }

      const row = data as Record<string, unknown>;
      setUser({
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

    // Re-read the session + profile. Called on mount, on auth changes, and
    // whenever something (e.g. an avatar upload) fires "bcj:user-refresh".
    async function syncFromSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) void loadProfile(user.id, user.email ?? "");
      else { setUser(null); setLoading(false); }
    }

    void syncFromSession();

    // Subscribe to auth state changes (sign-in / sign-out / token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        void loadProfile(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Lets any component (profile photo upload, settings save) refresh the
    // current-user across the app without a full reload.
    const onRefresh = () => { void syncFromSession(); };
    window.addEventListener("bcj:user-refresh", onRefresh);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("bcj:user-refresh", onRefresh);
    };
  }, []);

  return { user, loading, isDemoMode: DEMO_MODE };
}
