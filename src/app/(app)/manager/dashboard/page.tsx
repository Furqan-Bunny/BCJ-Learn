import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { listActivityForUser } from "@/lib/db/activity";
import { getCheckedInStatus, getCurrentDelivery } from "@/lib/db/deliveries";
import { ManagerDashboardView } from "./dashboard-view";
import type { Cohort, ManagerStatus } from "@/types";

export default async function ManagerDashboardPage() {
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [modules, attempts, activity] = await Promise.all([
    listModules(),
    listAttemptsForManager(me.id),
    listActivityForUser(me.id, 5),
  ]);

  // Derive manager stats from attempts.
  const passedAttempts = attempts.filter((a) => a.status === "passed");
  const passedSlugs = new Set(passedAttempts.map((a) => a.moduleSlug));
  const modulesCompleted = passedSlugs.size;
  const averageScore =
    passedAttempts.length === 0
      ? 0
      : Math.round(passedAttempts.reduce((sum, a) => sum + Number(a.scorePct), 0) / passedAttempts.length);

  // Next-module check-in + session lifecycle. Match the dashboard view: only
  // published modules, ordered by scheduled training day (soonest first).
  const orderKey = (m: (typeof modules)[number]) =>
    m.scheduledDate ? new Date(m.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
  const orderedModules = modules
    .filter((m) => m.status === "published")
    .sort((a, b) => orderKey(a) - orderKey(b) || a.number - b.number);
  const nextModule = orderedModules.find((m) => !passedSlugs.has(m.slug)) ?? orderedModules[orderedModules.length - 1];
  const [checkInStatus, delivery] = nextModule
    ? await Promise.all([getCheckedInStatus(nextModule.slug, me.id), getCurrentDelivery(nextModule.slug)])
    : [{ checkedIn: false, checkedInAt: null }, null];

  return (
    <ManagerDashboardView
      me={{
        id: me.id,
        name: me.name,
        cohort: me.cohort as Cohort | null,
        status: (me.status ?? "active") as ManagerStatus,
        avatarColor: me.avatarColor,
        avatarUrl: me.avatarUrl ?? null,
        modulesCompleted,
        averageScore,
      }}
      modules={modules}
      myAttempts={attempts}
      myActivity={activity}
      nextModuleCheckIn={checkInStatus}
      nextModuleSession={{
        sessionStartedAt: delivery?.sessionStartedAt ?? null,
        sessionEndedAt: delivery?.sessionEndedAt ?? null,
        checkinOpen: !!delivery?.checkinOpenedAt,
      }}
    />
  );
}
