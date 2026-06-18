import { listModules } from "@/lib/db/modules";
import { listAttempts } from "@/lib/db/attempts";
import { listTeachers } from "@/lib/db/profiles";
import { listResources } from "@/lib/db/resources";
import { dbClient } from "@/lib/supabase/db-client";
import { AdminModulesView } from "./modules-view";
import type { Teacher } from "@/types";

export default async function AdminModulesPage() {
  const [modules, attempts, teachers, allSops] = await Promise.all([
    listModules(),
    listAttempts(),
    listTeachers(),
    listResources(),
  ]);

  // Enrich teachers with owned-module counts so AddModuleSheet shows "X modules owned" hints.
  const sb = await dbClient();
  const { data: ownerRows } = await sb.from("module_owners").select("module_slug, teacher_id");

  // Which modules have been DELIVERED — their current (open) delivery's session
  // has ended. Drives a "Delivered {date}" badge in the list.
  const { data: curDeliveries } = await sb
    .from("module_deliveries")
    .select("module_slug, session_ended_at")
    .is("ended_at", null);
  const deliveredBySlug: Record<string, string> = {};
  for (const d of (curDeliveries ?? []) as { module_slug: string; session_ended_at: string | null }[]) {
    if (d.session_ended_at) deliveredBySlug[d.module_slug] = d.session_ended_at;
  }
  const ownedByTeacher = new Map<string, string[]>();
  for (const o of (ownerRows ?? []) as { module_slug: string; teacher_id: string }[]) {
    const list = ownedByTeacher.get(o.teacher_id) ?? [];
    list.push(o.module_slug);
    ownedByTeacher.set(o.teacher_id, list);
  }
  const enrichedTeachers: Teacher[] = teachers.map((t) => ({
    ...t,
    ownedModuleSlugs: ownedByTeacher.get(t.id) ?? [],
  }));

  const teacherNamesById: Record<string, string> = {};
  for (const t of teachers) teacherNamesById[t.id] = t.name;

  const defaultNumber = modules.length > 0 ? Math.max(...modules.map((m) => m.number)) + 1 : 1;

  return (
    <AdminModulesView
      modules={modules}
      attempts={attempts}
      teacherNamesById={teacherNamesById}
      teachers={enrichedTeachers}
      defaultNumber={defaultNumber}
      allSops={allSops}
      deliveredBySlug={deliveredBySlug}
    />
  );
}
