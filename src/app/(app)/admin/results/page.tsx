import { listAttempts, listAttendanceKeys } from "@/lib/db/attempts";
import { listAssignableUsers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { AdminResultsView, type AttemptRow } from "./results-view";

export default async function AdminResultsPage() {
  // listAssignableUsers (not listManagers) so Department Leads + Admins who took a
  // quiz themselves also show in results — their attempts were being dropped.
  const [attempts, managers, modules, attendanceKeys] = await Promise.all([
    listAttempts(),
    listAssignableUsers(),
    listModules(),
    listAttendanceKeys(),
  ]);

  const managerById = new Map(managers.map((m) => [m.id, m]));
  const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));

  const rows: AttemptRow[] = attempts
    // Only real attempts (submitted). Scheduled retakes + abandoned in-progress
    // rows are not attempts and must not show up or inflate the totals.
    .filter((a) => a.status === "passed" || a.status === "failed")
    .map((a): AttemptRow | null => {
      const m = managerById.get(a.managerId);
      const mod = moduleBySlug.get(a.moduleSlug);
      if (!m || !mod) return null;
      return {
        id: a.id,
        managerName: m.name,
        managerEmail: m.email,
        managerAvatarColor: m.avatarColor,
        managerAvatarUrl: m.avatarUrl ?? null,
        managerId: m.id,
        cohort: m.cohort,
        moduleSlug: mod.slug,
        moduleNumber: mod.number,
        moduleTitle: mod.title,
        pool: a.pool,
        status: a.status,
        startedAt: a.startedAt,
        scorePct: Number(a.scorePct),
        durationSec: a.durationSec,
        correctCount: a.correctCount,
        totalCount: a.totalCount,
        attended: !!a.deliveryId && attendanceKeys.has(`${a.managerId}:${a.deliveryId}`),
      };
    })
    .filter((x): x is AttemptRow => !!x)
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));

  return <AdminResultsView rows={rows} modules={modules} />;
}
