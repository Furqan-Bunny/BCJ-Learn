import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModulesAssignedToUser, getModulesBySlugs } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { ManagerModulesView } from "./modules-view";

export default async function ManagerModulesPage() {
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  // Employees see only the modules they're INVITED to (module_invitees) plus any
  // they've already attempted — NOT every published module. Leads/admins use the
  // /teacher and /admin lists which still show everything.
  const [assigned, myAttempts] = await Promise.all([
    listModulesAssignedToUser(me.id, me.locale),
    listAttemptsForManager(me.id),
  ]);
  const assignedSlugs = new Set(assigned.map((m) => m.slug));

  // …PLUS any attempted module now UN-published (so a passed module never
  // disappears). Fetched via service-role since the manager can't RLS-read it.
  const engagedSlugs = [...new Set(myAttempts.map((a) => a.moduleSlug))].filter((s) => !assignedSlugs.has(s));
  const engaged = await getModulesBySlugs(engagedSlugs, me.locale);

  return <ManagerModulesView modules={[...assigned, ...engaged]} myAttempts={myAttempts} />;
}
