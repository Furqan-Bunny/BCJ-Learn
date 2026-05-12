import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listManagers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { listAttempts } from "@/lib/db/attempts";
import { dbClient } from "@/lib/supabase/db-client";
import { TeacherTraineesView, type TraineeRow } from "./managers-view";

export default async function TeacherTraineesPage() {
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

  const [allManagers, allModules, allAttempts] = await Promise.all([
    listManagers(),
    listModules(),
    listAttempts(),
  ]);

  const myModules = allModules.filter((m) => ownedSlugs.has(m.slug));

  const rows: TraineeRow[] = allManagers.map((m) => {
    const ma = allAttempts.filter(
      (a) => a.managerId === m.id && ownedSlugs.has(a.moduleSlug),
    );
    const passed = ma.some((a) => a.status === "passed");
    const failed = !passed && ma.some((a) => a.status === "failed");
    const best = ma.length ? Math.max(...ma.map((a) => Number(a.scorePct))) : null;
    return {
      ...m,
      myModuleAttempts: ma.length,
      myModuleBestScore: best,
      myModuleStatus: passed ? "passed" : failed ? "failed" : "pending",
    };
  });

  return <TeacherTraineesView rows={rows} myModules={myModules} />;
}
