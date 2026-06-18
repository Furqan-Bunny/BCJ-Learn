import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listManagersByIds } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { dbClient } from "@/lib/supabase/db-client";
import { createAdminClient } from "@/lib/supabase/server";
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

  const allModules = await listModules();
  const myModules = allModules.filter((m) => ownedSlugs.has(m.slug));

  // "My team" = the employees INVITED to (or who attempted) the modules this lead
  // OWNS — not the whole company. Built via the service-role client so it doesn't
  // depend on teacher profile-read RLS (which otherwise returned an empty list).
  let rows: TraineeRow[] = [];
  if (ownedSlugs.size > 0) {
    const admin = createAdminClient();
    const slugs = [...ownedSlugs];
    const [{ data: delRows }, { data: attRows }] = await Promise.all([
      admin.from("module_deliveries").select("id").in("module_slug", slugs),
      admin.from("attempts").select("manager_id, module_slug, status, score_pct").in("module_slug", slugs),
    ]);
    const attempts = ((attRows ?? []) as { manager_id: string; status: string; score_pct: number }[]);
    const teamIds = new Set<string>(attempts.map((a) => a.manager_id));
    const deliveryIds = ((delRows ?? []) as { id: string }[]).map((d) => d.id);
    if (deliveryIds.length > 0) {
      const { data: inv } = await admin.from("module_invitees").select("manager_id").in("delivery_id", deliveryIds);
      for (const r of (inv ?? []) as { manager_id: string }[]) teamIds.add(r.manager_id);
    }

    const team = await listManagersByIds([...teamIds]);
    rows = team.map((m) => {
      // Only submitted attempts (passed/failed) count toward status + best score.
      const ma = attempts.filter(
        (a) => a.manager_id === m.id && (a.status === "passed" || a.status === "failed"),
      );
      const passed = ma.some((a) => a.status === "passed");
      const failed = !passed && ma.some((a) => a.status === "failed");
      const best = ma.length ? Math.max(...ma.map((a) => Number(a.score_pct))) : null;
      return {
        ...m,
        myModuleAttempts: ma.length,
        myModuleBestScore: best,
        myModuleStatus: passed ? "passed" : failed ? "failed" : "pending",
      };
    });
  }

  return <TeacherTraineesView rows={rows} myModules={myModules} />;
}
