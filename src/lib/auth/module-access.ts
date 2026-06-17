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

// Stricter guard for OWNER-only surfaces (present + results): an admin passes,
// a Department Lead passes only for a module they own. A non-owning lead is 404'd
// even via a direct URL — so "Present" / "See results" are truly scoped to the
// modules assigned to that lead (the buttons are also hidden in their list).
export async function getOwnedModuleOr404(slug: string): Promise<ModuleDef> {
  const [mod, me] = await Promise.all([getModule(slug), getCurrentUser()]);
  if (!mod || !me) notFound();
  if (me.role === "admin") return mod;
  if (me.role === "teacher" && mod.ownerTeacherIds.includes(me.id)) return mod;
  notFound();
}
