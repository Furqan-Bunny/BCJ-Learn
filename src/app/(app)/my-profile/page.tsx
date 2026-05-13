// My Profile — viewer-style page that summarises everything about the current
// user. Read-only; the editor lives at /settings/profile. Role-aware: managers
// see module progress + attempts, teachers see owned modules + question bank,
// admins see admin actions.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { listActivityForUser } from "@/lib/db/activity";
import { listMyNotifications } from "@/lib/db/notifications";
import { MyProfileView } from "./profile-view";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface FullProfile {
  phone: string | null;
  bio: string | null;
  title: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
}

async function loadFullProfile(userId: string): Promise<FullProfile> {
  if (DEMO_MODE) {
    return { phone: null, bio: null, title: null, joinedAt: null, lastActiveAt: null };
  }
  const sb = await createClient();
  const { data } = await sb
    .from("profiles")
    .select("phone, bio, title, joined_at, last_active_at")
    .eq("id", userId)
    .maybeSingle();
  const p = data as {
    phone?: string | null;
    bio?: string | null;
    title?: string | null;
    joined_at?: string | null;
    last_active_at?: string | null;
  } | null;
  return {
    phone: p?.phone ?? null,
    bio: p?.bio ?? null,
    title: p?.title ?? null,
    joinedAt: p?.joined_at ?? null,
    lastActiveAt: p?.last_active_at ?? null,
  };
}

export default async function MyProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const role: Role = me.role;
  const [full, allModules, activity, recentNotifs] = await Promise.all([
    loadFullProfile(me.id),
    listModules(),
    listActivityForUser(me.id, 10),
    listMyNotifications(5),
  ]);

  // Manager-specific data
  let attempts: Awaited<ReturnType<typeof listAttemptsForManager>> = [];
  if (role === "manager") {
    attempts = await listAttemptsForManager(me.id);
  }

  // Teacher-specific data — modules they own
  const ownedModules = role === "teacher"
    ? allModules.filter((m) => m.ownerTeacherIds.includes(me.id))
    : [];

  // Derived stats for managers
  const passedSlugs = new Set(attempts.filter((a) => a.status === "passed").map((a) => a.moduleSlug));
  const modulesCompleted = passedSlugs.size;
  const passedScores = attempts.filter((a) => a.status === "passed").map((a) => Number(a.scorePct));
  const averageScore =
    passedScores.length === 0 ? 0 : Math.round(passedScores.reduce((s, n) => s + n, 0) / passedScores.length);
  const failedAttempts = attempts.filter((a) => a.status === "failed").length;

  return (
    <MyProfileView
      me={{ ...me, joinedAt: full.joinedAt, lastActiveAt: full.lastActiveAt }}
      phone={full.phone}
      bio={full.bio}
      title={full.title}
      role={role}
      modules={allModules}
      ownedModules={ownedModules}
      attempts={attempts}
      activity={activity}
      recentNotifications={recentNotifs}
      stats={{ modulesCompleted, averageScore, failedAttempts }}
    />
  );
}
