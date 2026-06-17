// Page-level access guard for teacher/admin module surfaces.
//
// Department Leads (teachers) and Admins may open ANY module — present it, take
// it themselves, and view results. (Per BCJ's request, leads are no longer
// scoped to only the modules they own; they're trusted staff.) Editing content
// and questions stays owner/admin-guarded in the server actions themselves, so
// a non-owner lead can view but not silently mutate another lead's module.
// Managers (and signed-out visitors) never reach these surfaces.

import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { ModuleDef } from "@/types";

export async function getAccessibleModuleOr404(slug: string): Promise<ModuleDef> {
  const [mod, me] = await Promise.all([getModule(slug), getCurrentUser()]);
  if (!mod) notFound();
  // Only staff (admin / department lead) may reach teacher module surfaces.
  if (me && me.role !== "admin" && me.role !== "teacher") notFound();
  return mod;
}
