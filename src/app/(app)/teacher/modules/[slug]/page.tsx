import { getModule } from "@/lib/db/modules";
import { getAccessibleModuleOr404 } from "@/lib/auth/module-access";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listManagers } from "@/lib/db/profiles";
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
    listManagers(),
    listDeliveriesForModule(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
    getCurrentDelivery(slug),
  ]);

  const managersById = Object.fromEntries(
    allManagers.map((m) => [m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor, avatarUrl: m.avatarUrl, cohort: m.cohort }]),
  );

  const rosterIds = new Set(roster.map((r) => r.manager.id));
  const addableManagers = allManagers
    .filter((m) => !rosterIds.has(m.id) && m.status !== "inactive" && m.status !== "pending")
    .map((m) => ({ id: m.id, name: m.name }));

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
