import { listTeachers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { dbClient } from "@/lib/supabase/db-client";
import { AdminTeachersView } from "./teachers-view";
import type { Teacher } from "@/types";

export default async function AdminTeachersPage() {
  const [teachers, modules] = await Promise.all([listTeachers(), listModules()]);

  // Owner ↔ module map from module_owners table.
  const sb = await dbClient();
  const { data: ownerRows } = await sb.from("module_owners").select("module_slug, teacher_id");
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

  // Question counts per module — read directly from modules.questions_total/approved
  // (kept in sync by the AI generation flow).
  const totalByModule: Record<string, number> = {};
  const approvedByModule: Record<string, number> = {};
  for (const m of modules) {
    totalByModule[m.slug] = m.questionsTotal;
    approvedByModule[m.slug] = m.questionsApproved;
  }

  return (
    <AdminTeachersView
      teachers={enrichedTeachers}
      modules={modules}
      approvedByModule={approvedByModule}
      totalByModule={totalByModule}
    />
  );
}
