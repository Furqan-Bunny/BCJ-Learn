import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listManagers } from "@/lib/db/profiles";
import { listDeliveriesForModule, getCurrentDelivery } from "@/lib/db/deliveries";
import { getModuleRoster, getModuleRosterCounts } from "@/lib/db/roster";
import { TeacherModuleView } from "./module-view";

export default async function TeacherModulePage(props: PageProps<"/teacher/modules/[slug]">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();

  const [attempts, allManagers, deliveries, roster, counts, currentDelivery] = await Promise.all([
    listAttemptsForModule(slug),
    listManagers(),
    listDeliveriesForModule(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
    getCurrentDelivery(slug),
  ]);

  const managersById = Object.fromEntries(
    allManagers.map((m) => [m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor, cohort: m.cohort }]),
  );

  return (
    <TeacherModuleView
      mod={mod}
      attempts={attempts}
      roster={roster}
      counts={counts}
      deliveries={deliveries}
      managersById={managersById}
      currentDeliveryStart={currentDelivery?.startedAt ?? null}
    />
  );
}
