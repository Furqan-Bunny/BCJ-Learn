import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listTeachers } from "@/lib/db/profiles";
import { dbClient } from "@/lib/supabase/db-client";
import { TeacherModulesView } from "./modules-view";
import type { Teacher } from "@/types";

export default async function TeacherModulesListPage() {
  const me = await getCurrentUserForRole("teacher");
  if (!me) redirect("/login");

  const sb = await dbClient();
  const { data: ownerRows } = await sb
    .from("module_owners")
    .select("module_slug, teacher_id");

  const allOwnerRows = (ownerRows ?? []) as { module_slug: string; teacher_id: string }[];
  const ownedSlugs = new Set(allOwnerRows.filter((r) => r.teacher_id === me.id).map((r) => r.module_slug));

  const [allModules, allTeachers] = await Promise.all([listModules(), listTeachers()]);
  const myModules = allModules.filter((m) => ownedSlugs.has(m.slug));

  // Enrich teachers with owned-module counts for the AddModuleSheet picker.
  const ownedByTeacher = new Map<string, string[]>();
  for (const o of allOwnerRows) {
    const list = ownedByTeacher.get(o.teacher_id) ?? [];
    list.push(o.module_slug);
    ownedByTeacher.set(o.teacher_id, list);
  }
  const enrichedTeachers: Teacher[] = allTeachers.map((t) => ({
    ...t,
    ownedModuleSlugs: ownedByTeacher.get(t.id) ?? [],
  }));

  const defaultNumber = allModules.length > 0 ? Math.max(...allModules.map((m) => m.number)) + 1 : 1;

  return (
    <TeacherModulesView
      me={{ id: me.id }}
      myModules={myModules}
      teachers={enrichedTeachers}
      defaultNumber={defaultNumber}
    />
  );
}
