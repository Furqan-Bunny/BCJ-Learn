// Server component — fetches via Supabase (db/ helpers respect DEMO_MODE)
// and hands the data to the client view.

import {
  programStats,
  cohortBreakdown,
  moduleProgressBreakdown,
  atRiskManagers,
} from "@/lib/db/queries";
import { listRecentActivity } from "@/lib/db/activity";
import { listAllProfiles } from "@/lib/db/profiles";
import { AdminDashboardView } from "./dashboard-view";

export default async function AdminDashboardPage() {
  const [stats, cohorts, modules, atRisk, recentActivity, allUsers] = await Promise.all([
    programStats(),
    cohortBreakdown(),
    moduleProgressBreakdown(),
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
    />
  );
}
