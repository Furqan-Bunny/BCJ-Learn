// Page-level access guard for teacher/admin module surfaces.
//
// A department lead (teacher) may only open modules they OWN. Admins bypass.
// Anyone else (or a non-owner lead) gets a 404 — closes the hole where a lead
// could reach another lead's module/questions/results by typing the URL.

import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { ModuleDef } from "@/types";

export async function getAccessibleModuleOr404(slug: string): Promise<ModuleDef> {
  const [mod, me] = await Promise.all([getModule(slug), getCurrentUser()]);
  if (!mod) notFound();
  if (me && me.role === "teacher" && !mod.ownerTeacherIds.includes(me.id)) notFound();
  return mod;
}
