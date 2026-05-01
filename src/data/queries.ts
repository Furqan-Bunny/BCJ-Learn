// Helper queries on top of the static data files.

import type { Manager, ManagerStatus, Cohort } from "@/types";
import { managers } from "./users";
import { modules, moduleBySlug } from "./modules";
import { attempts } from "./attempts";

export interface ManagerFilter {
  search?: string;
  cohort?: Cohort | "all";
  status?: ManagerStatus | "all";
  atRiskOnly?: boolean;
}

export function filterManagers(filter: ManagerFilter): Manager[] {
  const search = (filter.search ?? "").trim().toLowerCase();
  return managers.filter((m) => {
    if (search) {
      const hay = `${m.name} ${m.email} ${m.cohort}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (filter.cohort && filter.cohort !== "all" && m.cohort !== filter.cohort) return false;
    if (filter.status && filter.status !== "all" && m.status !== filter.status) return false;
    if (filter.atRiskOnly && m.status !== "at-risk") return false;
    return true;
  });
}

export function programStats() {
  const totalManagers = managers.length;
  const activeManagers = managers.filter((m) => m.status === "active").length;
  const atRisk = managers.filter((m) => m.status === "at-risk").length;
  const completed = managers.filter((m) => m.status === "completed").length;

  const passedAttempts = attempts.filter((a) => a.status === "passed").length;
  const failedAttempts = attempts.filter((a) => a.status === "failed").length;
  const totalAttempts = passedAttempts + failedAttempts;
  const passRate = totalAttempts ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

  const avgScore = totalAttempts
    ? Math.round(
        attempts.filter((a) => a.scorePct > 0).reduce((s, a) => s + a.scorePct, 0) /
          attempts.filter((a) => a.scorePct > 0).length,
      )
    : 0;

  const liveModules = modules.filter((m) => m.status === "published").length;

  return {
    totalManagers,
    activeManagers,
    atRisk,
    completed,
    passRate,
    avgScore,
    liveModules,
    totalModules: modules.length,
    passedAttempts,
    failedAttempts,
  };
}

export function cohortBreakdown() {
  const cohorts: Cohort[] = ["Atlanta", "Dallas", "Phoenix"];
  return cohorts.map((c) => {
    const inCohort = managers.filter((m) => m.cohort === c);
    const completed = inCohort.filter((m) => m.status === "completed").length;
    const atRisk = inCohort.filter((m) => m.status === "at-risk").length;
    return {
      cohort: c,
      total: inCohort.length,
      completed,
      atRisk,
      active: inCohort.length - completed - atRisk,
    };
  });
}

export function moduleProgressBreakdown() {
  return modules.map((mod) => {
    const modAttempts = attempts.filter((a) => a.moduleSlug === mod.slug);
    const passed = modAttempts.filter((a) => a.status === "passed").length;
    const failed = modAttempts.filter((a) => a.status === "failed").length;
    return {
      slug: mod.slug,
      title: mod.title,
      number: mod.number,
      passed,
      failed,
      participation: modAttempts.length,
      avgScore: modAttempts.length
        ? Math.round(modAttempts.reduce((s, a) => s + a.scorePct, 0) / modAttempts.length)
        : 0,
    };
  });
}

export function scoreDistribution(slug?: string) {
  const buckets: { range: string; count: number }[] = [
    { range: "0-49", count: 0 },
    { range: "50-69", count: 0 },
    { range: "70-84", count: 0 },
    { range: "85-94", count: 0 },
    { range: "95-100", count: 0 },
  ];
  const list = slug ? attempts.filter((a) => a.moduleSlug === slug) : attempts;
  for (const a of list) {
    const s = a.scorePct;
    if (s < 50) buckets[0].count++;
    else if (s < 70) buckets[1].count++;
    else if (s < 85) buckets[2].count++;
    else if (s < 95) buckets[3].count++;
    else buckets[4].count++;
  }
  return buckets;
}

export function atRiskManagers(): Manager[] {
  return managers.filter((m) => m.status === "at-risk");
}

// ─── Roster for a single module ────────────────────────────────────────
// Every BCJ Account Manager is assigned the full 5-module program (per scope §5.3).
// Check-in flow: Manager logs in on training day → confirms presence → "checked-in".
// After the seminar they take the quiz on-site → "took quiz".
// Status priority (high → low): passed > failed > checked-in > didnt-attempt > awaiting.

export type RosterStatus = "passed" | "failed" | "checked-in" | "didnt-attempt" | "awaiting";

export interface RosterRow {
  manager: Manager;
  status: RosterStatus;
  bestScore: number | null;
  attemptCount: number;
  checkedIn: boolean;
  checkedInAt?: string;
}

export function moduleRoster(
  moduleSlug: string,
  checkedInIds: string[] = [],
  checkedInAtMap: Record<string, string> = {},
  deliveryStartDate?: string, // ISO; if provided, only attempts after this count toward status
  managerResetAtMap: Record<string, string> = {},
): RosterRow[] {
  const mod = moduleBySlug(moduleSlug);
  const trainingDate = mod ? new Date(mod.scheduledDate) : null;
  const now = new Date();
  const trainingDayPassed = trainingDate ? trainingDate.getTime() < now.getTime() : false;
  const checkedSet = new Set(checkedInIds);
  const moduleResetTs = deliveryStartDate ? new Date(deliveryStartDate).getTime() : null;

  return managers.map((m) => {
    // Effective cut-off: per-manager reset date wins if newer than module's
    const personalReset = managerResetAtMap[`${moduleSlug}:${m.id}`];
    const personalTs = personalReset ? new Date(personalReset).getTime() : null;
    const cutoff =
      moduleResetTs && personalTs ? Math.max(moduleResetTs, personalTs)
      : moduleResetTs ?? personalTs;

    const moduleAttempts = attempts.filter(
      (a) => a.managerId === m.id && a.moduleSlug === moduleSlug,
    );
    const currentAttempts = cutoff
      ? moduleAttempts.filter((a) => new Date(a.startedAt).getTime() >= cutoff)
      : moduleAttempts;

    const passed = currentAttempts.some((a) => a.status === "passed");
    const failed = !passed && currentAttempts.some((a) => a.status === "failed");
    const took = currentAttempts.length > 0;
    const isCheckedIn = checkedSet.has(m.id);
    const bestScore = currentAttempts.length
      ? Math.max(...currentAttempts.map((a) => a.scorePct))
      : null;

    let status: RosterStatus;
    if (passed) status = "passed";
    else if (failed) status = "failed";
    else if (took) status = "failed"; // edge case
    else if (isCheckedIn) status = "checked-in";
    else if (trainingDayPassed && !cutoff) status = "didnt-attempt";
    else status = "awaiting";

    return {
      manager: m,
      status,
      bestScore,
      attemptCount: currentAttempts.length,
      checkedIn: isCheckedIn,
      checkedInAt: checkedInAtMap[`${moduleSlug}:${m.id}`],
    };
  });
}

// ─── Delivery history for a module ─────────────────────────────────────
// Each delivery is a date range. The first delivery starts on the module's
// original scheduledDate. Subsequent deliveries start when admin re-delivers.
// An attempt belongs to the delivery whose [start, nextStart) range contains it.

export interface DeliveryRecord {
  index: number;          // 1-based delivery number
  startDate: string;      // ISO
  endDate: string | null; // ISO or null = current/ongoing
  isCurrent: boolean;
  attempts: number;
  passed: number;
  failed: number;
  participantIds: string[]; // managers who attempted in this delivery
}

export function moduleDeliveries(
  moduleSlug: string,
  pastDeliveryStarts: string[],
  currentDeliveryStart?: string,
): DeliveryRecord[] {
  const mod = moduleBySlug(moduleSlug);
  if (!mod) return [];

  // Re-delivery boundaries (NOT including module's original scheduledDate).
  // Each one represents the start of a NEW delivery period.
  const reDeliveryBoundaries: string[] = [];
  for (const d of pastDeliveryStarts) if (!reDeliveryBoundaries.includes(d)) reDeliveryBoundaries.push(d);
  if (currentDeliveryStart && !reDeliveryBoundaries.includes(currentDeliveryStart)) {
    reDeliveryBoundaries.push(currentDeliveryStart);
  }
  reDeliveryBoundaries.sort((a, b) => +new Date(a) - +new Date(b));

  // Delivery start dates list (D1 = module's original scheduled date, then each re-delivery)
  const startDates: string[] = [mod.scheduledDate, ...reDeliveryBoundaries];

  return startDates.map((startDate, i) => {
    const isLast = i === startDates.length - 1;
    const isFirst = i === 0;
    const endDate = isLast ? null : startDates[i + 1];

    // D1 has NO lower bound — captures every historical attempt.
    // Subsequent deliveries start at their boundary date.
    // This handles the realistic case where attempts predate the official scheduledDate
    // (e.g., demo data, makeup attempts, etc.).
    const startMs = isFirst ? -Infinity : new Date(startDate).getTime();
    const endMs = endDate ? new Date(endDate).getTime() : Infinity;

    const within = attempts.filter((a) => {
      if (a.moduleSlug !== moduleSlug) return false;
      const t = new Date(a.startedAt).getTime();
      return t >= startMs && t < endMs;
    });
    const passed = within.filter((a) => a.status === "passed").length;
    const failed = within.filter((a) => a.status === "failed").length;
    const participantIds = Array.from(new Set(within.map((a) => a.managerId)));

    return {
      index: i + 1,
      startDate,
      endDate,
      isCurrent: isLast,
      attempts: within.length,
      passed,
      failed,
      participantIds,
    };
  });
}

export interface RosterCounts {
  expected: number;
  passed: number;
  failed: number;
  checkedIn: number;       // currently checked in (not yet quizzed)
  didntAttempt: number;
  awaiting: number;
  tookQuiz: number;
  totalPresent: number;    // checked-in + tookQuiz (everyone who was/is in the room)
}

export function moduleRosterCounts(
  moduleSlug: string,
  checkedInIds: string[] = [],
  checkedInAtMap: Record<string, string> = {},
  deliveryStartDate?: string,
  managerResetAtMap: Record<string, string> = {},
): RosterCounts {
  const roster = moduleRoster(moduleSlug, checkedInIds, checkedInAtMap, deliveryStartDate, managerResetAtMap);
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
