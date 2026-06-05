import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
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
    />
  );
}
