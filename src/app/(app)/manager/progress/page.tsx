import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules, getModuleSummariesBySlugs } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { ManagerProgressView } from "./progress-view";
import type { ManagerStatus } from "@/types";

export default async function ManagerProgressPage() {
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [modules, myAttempts] = await Promise.all([
    listModules(me.locale),
    listAttemptsForManager(me.id),
  ]);

  const passedAttempts = myAttempts.filter((a) => a.status === "passed");
  const passedSlugs = new Set(passedAttempts.map((a) => a.moduleSlug));
  const modulesCompleted = passedSlugs.size;
  const averageScore =
    passedAttempts.length === 0
      ? 0
      : Math.round(passedAttempts.reduce((sum, a) => sum + Number(a.scorePct), 0) / passedAttempts.length);

  // Certificates are earned per PASSED module — derived from the attempts, not
  // the (RLS-filtered, possibly-empty) modules list. Titles/numbers resolved via
  // service-role so a manager who isn't a current invitee still sees their cert.
  const summaries = await getModuleSummariesBySlugs([...passedSlugs], me.locale);
  const certificates = [...passedSlugs].map((slug) => {
    const s = summaries.get(slug);
    return { slug, title: s?.title ?? slug, number: s?.number ?? null };
  }).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  return (
    <ManagerProgressView
      me={{
        id: me.id,
        modulesCompleted,
        averageScore,
        status: (me.status ?? "active") as ManagerStatus,
      }}
      modules={modules}
      myAttempts={myAttempts}
      certificates={certificates}
    />
  );
}
