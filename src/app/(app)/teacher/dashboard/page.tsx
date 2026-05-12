import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listAttemptsForModule } from "@/lib/db/attempts";
import { dbClient } from "@/lib/supabase/db-client";
import { TeacherDashboardView } from "./dashboard-view";
import type { Attempt } from "@/types";

export default async function TeacherDashboardPage() {
  const me = await getCurrentUserForRole("teacher");
  if (!me) redirect("/login");

  const sb = await dbClient();
  const { data: ownerRows } = await sb
    .from("module_owners")
    .select("module_slug")
    .eq("teacher_id", me.id);
  const ownedSlugs = new Set(
    ((ownerRows ?? []) as { module_slug: string }[]).map((r) => r.module_slug),
  );

  const allModules = await listModules();
  const myModules = allModules.filter((m) => ownedSlugs.has(m.slug));

  const attemptsLists = await Promise.all(myModules.map((m) => listAttemptsForModule(m.slug)));
  const attemptsByModule: Record<string, Attempt[]> = {};
  myModules.forEach((m, i) => {
    attemptsByModule[m.slug] = attemptsLists[i];
  });

  return (
    <TeacherDashboardView
      me={{ id: me.id, name: me.name }}
      myModules={myModules}
      attemptsByModule={attemptsByModule}
    />
  );
}
