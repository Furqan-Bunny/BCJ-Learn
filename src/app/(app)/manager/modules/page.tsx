import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules, getModulesBySlugs } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { ManagerModulesView } from "./modules-view";

export default async function ManagerModulesPage() {
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [modules, myAttempts] = await Promise.all([
    listModules(me.locale),
    listAttemptsForManager(me.id),
  ]);

  // Managers see published modules…
  const published = modules.filter((m) => m.status === "published");
  const publishedSlugs = new Set(published.map((m) => m.slug));

  // …PLUS any module they've already engaged with (an attempt) that isn't in the
  // published set — e.g. a module they PASSED that was later un-published. A
  // passed/attempted module should never disappear from the learner's list.
  // Fetched via service-role since the manager can't read non-published modules.
  const engagedSlugs = [...new Set(myAttempts.map((a) => a.moduleSlug))].filter((s) => !publishedSlugs.has(s));
  const engaged = await getModulesBySlugs(engagedSlugs, me.locale);

  return <ManagerModulesView modules={[...published, ...engaged]} myAttempts={myAttempts} />;
}
