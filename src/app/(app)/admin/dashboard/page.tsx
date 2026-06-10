// Server component — fetches via Supabase (db/ helpers respect DEMO_MODE)
// and hands the data to the client view.

import {
  programStats,
  cohortBreakdown,
  moduleProgressBreakdown,
  atRiskManagers,
  type DateRange,
} from "@/lib/db/queries";
import { listRecentActivity } from "@/lib/db/activity";
import { listAllProfiles } from "@/lib/db/profiles";
import { AdminDashboardView } from "./dashboard-view";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range: DateRange = { from: sp.from || undefined, to: sp.to || undefined };

  const [stats, cohorts, modules, atRisk, recentActivity, allUsers] = await Promise.all([
    programStats(range),
    cohortBreakdown(),
    moduleProgressBreakdown(range),
    atRiskManagers(),
    listRecentActivity(8),
    listAllProfiles(),
  ]);

  return (
    <AdminDashboardView
      stats={stats}
      cohorts={cohorts}
      modules={modules}
      atRisk={atRisk}
      recentActivity={recentActivity}
      allUsers={allUsers}
      from={range.from ?? ""}
      to={range.to ?? ""}
    />
  );
}
