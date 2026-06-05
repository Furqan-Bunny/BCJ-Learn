import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { ManagerModulesView } from "./modules-view";

export default async function ManagerModulesPage() {
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [modules, myAttempts] = await Promise.all([
    listModules(me.locale),
    listAttemptsForManager(me.id),
  ]);

  // Managers only see published modules.
  const published = modules.filter((m) => m.status === "published");

  return <ManagerModulesView modules={published} myAttempts={myAttempts} />;
}
