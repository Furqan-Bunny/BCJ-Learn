import { listManagers } from "@/lib/db/profiles";
import { listAttempts } from "@/lib/db/attempts";
import { listModules } from "@/lib/db/modules";
import { AdminManagersView } from "./managers-view";
import type { Manager } from "@/types";

export default async function AdminManagersPage() {
  const [managers, attempts, modules] = await Promise.all([listManagers(), listAttempts(), listModules()]);

  // Enrich each manager with derived stats from attempts.
  const enriched: Manager[] = managers.map((m) => {
    const mine = attempts.filter((a) => a.managerId === m.id);
    const passed = mine.filter((a) => a.status === "passed");
    const failed = mine.filter((a) => a.status === "failed");
    const passedSlugs = new Set(passed.map((a) => a.moduleSlug));
    const averageScore =
      passed.length === 0 ? 0 : Math.round(passed.reduce((s, a) => s + Number(a.scorePct), 0) / passed.length);
    return {
      ...m,
      modulesCompleted: passedSlugs.size,
      averageScore,
      failedAttempts: failed.length,
    };
  });

  return <AdminManagersView managers={enriched} totalModules={modules.length} />;
}
