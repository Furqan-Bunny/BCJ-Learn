// Module roster — derives per-(invitee, current-delivery) status from the
// `module_roster_view` introduced in migration 0004.
//
// Status priority (high → low):
//   passed > failed > checked-in > didnt-attempt > awaiting
//
// "didnt-attempt" requires that the scheduled training date has passed.
// "awaiting" covers everyone else — pre-training-day or recently reset.

import { dbClient } from "@/lib/supabase/db-client";
import type { Manager, ManagerStatus, Cohort } from "@/types";

export type RosterStatus = "passed" | "failed" | "checked-in" | "didnt-attempt" | "awaiting";

export interface RosterRow {
  manager: Manager;
  status: RosterStatus;
  bestScore: number | null;
  attemptCount: number;
  checkedIn: boolean;
  checkedInAt?: string;
}

export interface RosterCounts {
  expected: number;
  passed: number;
  failed: number;
  checkedIn: number;
  didntAttempt: number;
  awaiting: number;
  tookQuiz: number;
  totalPresent: number;
}

interface RosterViewRow {
  manager_id: string;
  name: string;
  email: string;
  avatar_color: string;
  cohort: Cohort | null;
  profile_status: ManagerStatus | null;
  last_active_at: string;
  module_slug: string;
  delivery_id: string;
  delivery_index: number;
  delivery_started_at: string;
  delivery_scheduled_date: string | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  effective_cutoff: string;
  latest_attempt_status: string | null;
  latest_score_pct: number | null;
  latest_pool: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
}

function viewRowToRoster(r: RosterViewRow): RosterRow {
  // Determine if the scheduled training date has passed.
  const trainingDate = r.delivery_scheduled_date ? new Date(r.delivery_scheduled_date) : null;
  const trainingDayPassed = trainingDate ? trainingDate.getTime() < Date.now() : false;

  const passed = r.latest_attempt_status === "passed";
  const failed = !passed && r.latest_attempt_status === "failed";
  const took = r.latest_attempt_status === "passed" || r.latest_attempt_status === "failed";

  let status: RosterStatus;
  if (passed) status = "passed";
  else if (failed) status = "failed";
  else if (took) status = "failed"; // edge — non-passed terminal status
  else if (r.checked_in) status = "checked-in";
  else if (trainingDayPassed) status = "didnt-attempt";
  else status = "awaiting";

  const manager: Manager = {
    id: r.manager_id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    role: "manager",
    cohort: (r.cohort ?? "Georgia") as Cohort,
    joinedAt: r.delivery_started_at, // unused by callers; keep a sane value
    lastActiveAt: r.last_active_at,
    status: (r.profile_status ?? "active") as ManagerStatus,
    modulesCompleted: 0,
    averageScore: 0,
    failedAttempts: 0,
    flaggedReasons: [],
  };

  return {
    manager,
    status,
    bestScore: r.latest_score_pct != null ? Number(r.latest_score_pct) : null,
    attemptCount: took ? 1 : 0,
    checkedIn: r.checked_in,
    checkedInAt: r.checked_in_at ?? undefined,
  };
}

export async function getModuleRoster(slug: string): Promise<RosterRow[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("module_roster_view")
    .select("*")
    .eq("module_slug", slug)
    .order("name");
  const rows = ((data ?? []) as RosterViewRow[]).map(viewRowToRoster);

  // The roster view doesn't expose avatar_url — batch-fetch + merge so the
  // roster shows uploaded profile photos (not just initials).
  const ids = rows.map((r) => r.manager.id);
  if (ids.length > 0) {
    const { data: pics } = await sb.from("profiles").select("id, avatar_url").in("id", ids);
    const byId = new Map(
      ((pics ?? []) as { id: string; avatar_url: string | null }[]).map((p) => [p.id, p.avatar_url]),
    );
    for (const r of rows) r.manager.avatarUrl = byId.get(r.manager.id) ?? null;
  }
  return rows;
}

export async function getModuleRosterCounts(slug: string): Promise<RosterCounts> {
  const roster = await getModuleRoster(slug);
  const passed = roster.filter((r) => r.status === "passed").length;
  const failed = roster.filter((r) => r.status === "failed").length;
  const checkedIn = roster.filter((r) => r.status === "checked-in").length;
  const didntAttempt = roster.filter((r) => r.status === "didnt-attempt").length;
  const awaiting = roster.filter((r) => r.status === "awaiting").length;
  const tookQuiz = passed + failed;
  return {
    expected: roster.length,
    passed,
    failed,
    checkedIn,
    didntAttempt,
    awaiting,
    tookQuiz,
    totalPresent: checkedIn + tookQuiz,
  };
}
