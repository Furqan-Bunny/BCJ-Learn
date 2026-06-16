import { getModule } from "@/lib/db/modules";
import { getAccessibleModuleOr404 } from "@/lib/auth/module-access";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listAssignableUsers } from "@/lib/db/profiles";
import { getAddableEmployees } from "@/lib/server/module-actions";
import { listDeliveriesForModule, getCurrentDelivery } from "@/lib/db/deliveries";
import { getModuleRoster, getModuleRosterCounts } from "@/lib/db/roster";
import { TeacherModuleView } from "./module-view";
import type { Metadata } from "next";

export async function generateMetadata(props: PageProps<"/teacher/modules/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return { title: "Module" };
  return { title: `${mod.title} — Module ${mod.number}`, description: mod.description };
}

export default async function TeacherModulePage(props: PageProps<"/teacher/modules/[slug]">) {
  const { slug } = await props.params;
  const mod = await getAccessibleModuleOr404(slug);

  const [attempts, allManagers, deliveries, roster, counts, currentDelivery] = await Promise.all([
    listAttemptsForModule(slug),
    listAssignableUsers(),
    listDeliveriesForModule(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
    getCurrentDelivery(slug),
  ]);

  const managersById = Object.fromEntries(
    allManagers.map((m) => [m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor, avatarUrl: m.avatarUrl, cohort: m.cohort }]),
  );

  // Full active directory via a guarded action — teacher profile reads are
  // scoped to their own modules (0048), so the picker can't use a broad query.
  const rosterIds = new Set(roster.map((r) => r.manager.id));
  const addableManagers = (await getAddableEmployees(slug)).filter((m) => !rosterIds.has(m.id));

  return (
    <TeacherModuleView
      mod={mod}
      attempts={attempts}
      roster={roster}
      counts={counts}
      deliveries={deliveries}
      managersById={managersById}
      currentDeliveryStart={currentDelivery?.startedAt ?? null}
      addableManagers={addableManagers}
    />
  );
}
