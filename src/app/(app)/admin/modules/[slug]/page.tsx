import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { listQuestionsForModule } from "@/lib/db/questions";
import { listTeachers, listManagers } from "@/lib/db/profiles";
import { listDeliveriesForModule, getCurrentDelivery } from "@/lib/db/deliveries";
import { getModuleRoster, getModuleRosterCounts } from "@/lib/db/roster";
import { listResourcesForModule } from "@/lib/db/module-resources";
import { listResources } from "@/lib/db/resources";
import { AdminModuleView } from "./module-view";
import type { Teacher } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(props: PageProps<"/admin/modules/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return { title: "Module" };
  return { title: `${mod.title} — Module ${mod.number}`, description: mod.description };
}

export default async function AdminModuleDetailPage(props: PageProps<"/admin/modules/[slug]">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();

  const [attempts, questions, allTeachers, allManagers, deliveries, roster, counts, currentDelivery, linkedSops, allSops] = await Promise.all([
    listAttemptsForModule(slug),
    listQuestionsForModule(slug),
    listTeachers(),
    listManagers(),
    listDeliveriesForModule(slug),
    getModuleRoster(slug),
    getModuleRosterCounts(slug),
    getCurrentDelivery(slug),
    listResourcesForModule(slug),
    listResources(),
  ]);

  const moduleTeachers: Teacher[] = allTeachers.filter((t) => mod.ownerTeacherIds.includes(t.id));
  const managersById = Object.fromEntries(
    allManagers.map((m) => [m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor, cohort: m.cohort }]),
  );

  // Active employees not already on the current seminar roster — for the
  // "Add employee" picker.
  const rosterIds = new Set(roster.map((r) => r.manager.id));
  const addableManagers = allManagers
    .filter((m) => !rosterIds.has(m.id) && m.status !== "inactive" && m.status !== "pending")
    .map((m) => ({ id: m.id, name: m.name }));

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
      addableManagers={addableManagers}
      linkedSops={linkedSops}
      allSops={allSops}
    />
  );
}
