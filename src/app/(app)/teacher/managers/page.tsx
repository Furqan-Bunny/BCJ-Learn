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

  // "My team" = only the employees who are INVITED to (or have attempted) the
  // modules this lead owns — not the whole company.
  const teamIds = new Set<string>();
  for (const a of allAttempts) if (ownedSlugs.has(a.moduleSlug)) teamIds.add(a.managerId);
  if (ownedSlugs.size > 0) {
    const { data: delRows } = await sb
      .from("module_deliveries")
      .select("id")
      .in("module_slug", [...ownedSlugs]);
    const deliveryIds = ((delRows ?? []) as { id: string }[]).map((d) => d.id);
    if (deliveryIds.length > 0) {
      const { data: inviteeRows } = await sb
        .from("module_invitees")
        .select("manager_id")
        .in("delivery_id", deliveryIds);
      for (const r of (inviteeRows ?? []) as { manager_id: string }[]) teamIds.add(r.manager_id);
    }
  }

  const rows: TraineeRow[] = allManagers.filter((m) => teamIds.has(m.id)).map((m) => {
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
