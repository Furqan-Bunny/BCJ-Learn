// Aggregate queries — program-wide stats, cohort/module breakdowns, score
// distribution, and at-risk/manager filtering, all backed by Supabase.

import { dbClient } from "@/lib/supabase/db-client";
import { listAttempts } from "./attempts";
import { listManagers } from "./profiles";
import { listModules } from "./modules";
import type { Manager, Cohort, ManagerStatus } from "@/types";

export interface ManagerFilter {
  search?: string;
  cohort?: Cohort | "all";
  status?: ManagerStatus | "all";
  atRiskOnly?: boolean;
}

export async function filterManagers(filter: ManagerFilter): Promise<Manager[]> {
  const all = await listManagers();
  const search = (filter.search ?? "").trim().toLowerCase();
  return all.filter((m) => {
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

export async function programStats() {
  const sb = await dbClient();
  const [
    { count: totalManagers },
    { count: activeManagers },
    { count: atRisk },
    { count: completed },
    { data: attempts },
    { count: liveModules },
    { count: totalModules },
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("role", "manager"),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("role", "manager").eq("status", "active"),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("role", "manager").eq("status", "at-risk"),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("role", "manager").eq("status", "completed"),
    sb.from("attempts").select("status, score_pct"),
    sb.from("modules").select("*", { count: "exact", head: true }).eq("status", "published"),
    sb.from("modules").select("*", { count: "exact", head: true }),
  ]);

  const att = (attempts ?? []) as { status: string; score_pct: number }[];
  const passedAttempts = att.filter((a) => a.status === "passed").length;
  const failedAttempts = att.filter((a) => a.status === "failed").length;
  const totalAttempts = passedAttempts + failedAttempts;
  const passRate = totalAttempts ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
  const scored = att.filter((a) => a.score_pct > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, a) => s + a.score_pct, 0) / scored.length)
    : 0;

  return {
    totalManagers: totalManagers ?? 0,
    activeManagers: activeManagers ?? 0,
    atRisk: atRisk ?? 0,
    completed: completed ?? 0,
    passRate,
    avgScore,
    liveModules: liveModules ?? 0,
    totalModules: totalModules ?? 0,
    passedAttempts,
    failedAttempts,
  };
}

export async function cohortBreakdown() {
  const managers = await listManagers();
  const cohorts: Cohort[] = ["Atlanta", "Nashville", "Charlotte"];
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

export async function moduleProgressBreakdown() {
  const [modules, attempts] = await Promise.all([listModules(), listAttempts()]);
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

export async function scoreDistribution(slug?: string) {
  const attempts = await listAttempts();
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

export async function atRiskManagers(): Promise<Manager[]> {
  const all = await listManagers();
  return all.filter((m) => m.status === "at-risk");
}
