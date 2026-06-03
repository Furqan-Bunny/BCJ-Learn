import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listManagers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { dbClient } from "@/lib/supabase/db-client";
import { TeacherResultsView } from "./results-view";
import type { AttemptRow } from "@/app/(app)/admin/results/results-view";

export default async function TeacherResultsPage() {
  const me = await getCurrentUserForRole("teacher");
  if (!me) redirect("/login");

  const sb = await dbClient();
  const { data: ownerRows } = await sb
    .from("module_owners")
    .select("module_slug")
    .eq("teacher_id", me.id);
  const ownedSlugs = ((ownerRows ?? []) as { module_slug: string }[]).map((r) => r.module_slug);

  const [allModules, managers, ...attemptsLists] = await Promise.all([
    listModules(),
    listManagers(),
    ...ownedSlugs.map((slug) => listAttemptsForModule(slug)),
  ]);

  const allAttempts = attemptsLists.flat();
  const myModules = allModules.filter((m) => ownedSlugs.includes(m.slug));

  const managerById = new Map(managers.map((m) => [m.id, m]));
  const moduleBySlug = new Map(myModules.map((m) => [m.slug, m]));

  const rows: AttemptRow[] = allAttempts
    // Only real attempts (submitted) — exclude scheduled retakes + in-progress.
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
      };
    })
    .filter((x): x is AttemptRow => !!x)
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));

  return <TeacherResultsView rows={rows} myModules={myModules} />;
}
