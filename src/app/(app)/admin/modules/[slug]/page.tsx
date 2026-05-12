import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listQuestionsForModule } from "@/lib/db/questions";
import { listTeachers, listManagers } from "@/lib/db/profiles";
import { listDeliveriesForModule, getCurrentDelivery } from "@/lib/db/deliveries";
import { getModuleRoster, getModuleRosterCounts } from "@/lib/db/roster";
import { AdminModuleView } from "./module-view";
import type { Teacher } from "@/types";

export default async function AdminModuleDetailPage(props: PageProps<"/admin/modules/[slug]">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();

  const [attempts, questions, allTeachers, allManagers, deliveries, roster, counts, currentDelivery] = await Promise.all([
    listAttemptsForModule(slug),
    listQuestionsForModule(slug),
    listTeachers(),
    listManagers(),
    listDeliveriesForModule(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
    getCurrentDelivery(slug),
  ]);

  const moduleTeachers: Teacher[] = allTeachers.filter((t) => mod.ownerTeacherIds.includes(t.id));
  const managersById = Object.fromEntries(
    allManagers.map((m) => [m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor, cohort: m.cohort }]),
  );

  return (
    <AdminModuleView
      mod={mod}
      moduleTeachers={moduleTeachers}
      attempts={attempts}
      questions={questions}
      roster={roster}
      counts={counts}
      deliveries={deliveries}
      managersById={managersById}
      currentDeliveryStart={currentDelivery?.startedAt ?? null}
    />
  );
}
