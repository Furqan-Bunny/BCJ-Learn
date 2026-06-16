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
import { listModulesAssignedToUser } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AssignedTraining } from "@/components/shared/assigned-training";
import { AdminDashboardView } from "./dashboard-view";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range: DateRange = { from: sp.from || undefined, to: sp.to || undefined };

  const me = await getCurrentUser();
  const [stats, cohorts, modules, atRisk, recentActivity, allUsers, assignedModules, myAttempts] = await Promise.all([
    programStats(range),
    cohortBreakdown(),
    moduleProgressBreakdown(range),
    atRiskManagers(),
    listRecentActivity(8),
    listAllProfiles(),
    me ? listModulesAssignedToUser(me.id) : Promise.resolve([]),
    me ? listAttemptsForManager(me.id) : Promise.resolve([]),
  ]);

  return (
    <>
    <AssignedTraining modules={assignedModules} attempts={myAttempts} />
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
    </>
  );
}
