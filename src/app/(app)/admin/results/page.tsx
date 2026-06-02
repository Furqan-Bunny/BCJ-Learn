import { listAttempts } from "@/lib/db/attempts";
import { listManagers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { AdminResultsView, type AttemptRow } from "./results-view";

export default async function AdminResultsPage() {
  const [attempts, managers, modules] = await Promise.all([
    listAttempts(),
    listManagers(),
    listModules(),
  ]);

  const managerById = new Map(managers.map((m) => [m.id, m]));
  const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));

  const rows: AttemptRow[] = attempts
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
      };
    })
    .filter((x): x is AttemptRow => !!x)
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));

  return <AdminResultsView rows={rows} modules={modules} />;
}
