"use server";

// CSV export — server actions return a CSV string the client downloads via
// the `download-csv` helper. Admin-only.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Cohort, Role } from "@/types";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const p = data as { role?: Role } | null;
  if (!p || p.role !== "admin") return { ok: false, error: "Admin access required" };
  return { ok: true };
}

// Defang fields whose first character is interpreted as a formula prefix by
// Excel / LibreOffice / Numbers (=, +, -, @, tab, CR). Prepending a single
// quote makes spreadsheet apps treat the cell as a literal string.
// See OWASP "CSV Injection" / formula-injection (CWE-1236).
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(csvEscape).join(",");
  const bodyLines = rows.map((r) => r.map(csvEscape).join(","));
  return [headerLine, ...bodyLines].join("\n");
}

export interface ExportResultsFilter {
  moduleSlug?: string;
  cohort?: Cohort;
  from?: string;
  to?: string;
}

export async function exportResultsCsv(filter: ExportResultsFilter = {}): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  let q = admin
    .from("attempts")
    .select(
      "id, manager_id, module_slug, pool, status, score_pct, correct_count, total_count, duration_sec, started_at, submitted_at",
    )
    .order("started_at", { ascending: false });

  if (filter.moduleSlug) q = q.eq("module_slug", filter.moduleSlug);
  if (filter.from) q = q.gte("started_at", filter.from);
  if (filter.to) q = q.lte("started_at", filter.to);

  const { data: attemptsRaw, error } = await q;
  if (error) return { ok: false, error: error.message };
  const attempts = (attemptsRaw ?? []) as {
    id: string;
    manager_id: string;
    module_slug: string;
    pool: string;
    status: string;
    score_pct: number;
    correct_count: number;
    total_count: number;
    duration_sec: number | null;
    started_at: string;
    submitted_at: string | null;
  }[];

  const managerIds = Array.from(new Set(attempts.map((a) => a.manager_id)));
  const moduleSlugs = Array.from(new Set(attempts.map((a) => a.module_slug)));

  const [profiles, modules] = await Promise.all([
    admin.from("profiles").select("id, name, email, cohort").in("id", managerIds.length ? managerIds : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("modules").select("slug, number, title").in("slug", moduleSlugs.length ? moduleSlugs : ["__none__"]),
  ]);

  const profilesById = new Map(
    (profiles.data ?? []).map((p) => [
      (p as { id: string }).id,
      p as { id: string; name: string; email: string; cohort: string | null },
    ]),
  );
  const modulesBySlug = new Map(
    (modules.data ?? []).map((m) => [
      (m as { slug: string }).slug,
      m as { slug: string; number: number; title: string },
    ]),
  );

  let rows = attempts.map((a) => {
    const p = profilesById.get(a.manager_id);
    const m = modulesBySlug.get(a.module_slug);
    return {
      employee: p?.name ?? a.manager_id,
      email: p?.email ?? "",
      cohort: p?.cohort ?? "",
      module: m ? `M${m.number} · ${m.title}` : a.module_slug,
      pool: a.pool,
      score: a.score_pct,
      correct: a.correct_count,
      total: a.total_count,
      status: a.status,
      duration_sec: a.duration_sec ?? "",
      started_at: a.started_at,
      submitted_at: a.submitted_at ?? "",
    };
  });

  if (filter.cohort) rows = rows.filter((r) => r.cohort === filter.cohort);

  const csv = rowsToCsv(
    ["Employee", "Email", "Cohort", "Module", "Pool", "Score %", "Correct", "Total", "Status", "Duration (s)", "Started at", "Submitted at"],
    rows.map((r) => [r.employee, r.email, r.cohort, r.module, r.pool, r.score, r.correct, r.total, r.status, r.duration_sec, r.started_at, r.submitted_at]),
  );

  return { ok: true, csv };
}

export async function exportAtRiskCsv(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("name, email, cohort, last_active_at, status")
    .eq("role", "manager")
    .eq("status", "at-risk");
  const rows = ((data ?? []) as {
    name: string;
    email: string;
    cohort: string | null;
    last_active_at: string;
    status: string;
  }[]).map((r) => [r.name, r.email, r.cohort ?? "", r.status, r.last_active_at]);

  return {
    ok: true,
    csv: rowsToCsv(["Employee", "Email", "Cohort", "Status", "Last active"], rows),
  };
}

export async function exportCohortSummaryCsv(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: profilesData } = await admin.from("profiles").select("cohort, status").eq("role", "manager");
  const profiles = ((profilesData ?? []) as { cohort: string | null; status: string | null }[]);

  const cohorts: Cohort[] = ["Atlanta", "Nashville", "Charlotte"];
  const rows = cohorts.map((c): (string | number)[] => {
    const inCohort = profiles.filter((p) => p.cohort === c);
    const completed = inCohort.filter((p) => p.status === "completed").length;
    const atRisk = inCohort.filter((p) => p.status === "at-risk").length;
    const active = inCohort.length - completed - atRisk;
    return [c, inCohort.length, active, completed, atRisk];
  });

  return {
    ok: true,
    csv: rowsToCsv(["Cohort", "Total employees", "Active", "Completed", "At-risk"], rows),
  };
}

export async function exportAttemptLogCsv(from?: string, to?: string): Promise<{ ok: boolean; csv?: string; error?: string }> {
  return exportResultsCsv({ from, to });
}
