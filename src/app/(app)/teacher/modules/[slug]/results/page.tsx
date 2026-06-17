import { getOwnedModuleOr404 } from "@/lib/auth/module-access";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listQuestionsForModule } from "@/lib/db/questions";
import { listManagers } from "@/lib/db/profiles";
import { scoreDistribution } from "@/lib/db/queries";
import { getModuleRoster, getModuleRosterCounts } from "@/lib/db/roster";
import { TeacherModuleResultsView } from "./results-view";
import type { Manager } from "@/types";

export default async function TeacherModuleResultsPage(props: PageProps<"/teacher/modules/[slug]/results">) {
  const { slug } = await props.params;
  // Owner-only (or admin) — leads see results for their own modules.
  const mod = await getOwnedModuleOr404(slug);

  const [attempts, questions, managers, distribution, roster, counts] = await Promise.all([
    listAttemptsForModule(slug),
    listQuestionsForModule(slug),
    listManagers(),
    scoreDistribution(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
  ]);

  const managersById: Record<string, Manager> = {};
  for (const m of managers) managersById[m.id] = m;

  return (
    <TeacherModuleResultsView
      mod={mod}
      attempts={attempts}
      questions={questions}
      managersById={managersById}
      distribution={distribution}
      roster={roster}
      counts={counts}
    />
  );
}
