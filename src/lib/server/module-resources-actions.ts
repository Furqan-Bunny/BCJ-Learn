"use server";

// Admin actions to link / unlink SOPs (resources) to a training module. The
// employee module page reads the link to decide which SOPs to gate the module
// behind.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Authorization guard: these actions write with the service-role client (which
// bypasses RLS), so the JS guard IS the real authz boundary. Linking/unlinking a
// SOP to a module is allowed for admins and for the Department Lead(s) who own
// that module — mirrors requireAdminOrModuleOwner in module-actions.ts.
async function requireAdminOrModuleOwner(
  moduleSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: profileRow } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const role = (profileRow as { role?: Role } | null)?.role;
  if (!role) return { ok: false, error: "Profile not found" };
  if (role === "admin") return { ok: true };
  if (role !== "teacher") return { ok: false, error: "Admin or teacher role required" };
  const { data: owner } = await sb
    .from("module_owners")
    .select("teacher_id")
    .eq("module_slug", moduleSlug)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!owner) return { ok: false, error: "You don't own this module" };
  return { ok: true };
}

export async function linkResourceToModule(
  moduleSlug: string,
  resourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) return { ok: true };
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("module_resources")
    .upsert(
      { module_slug: moduleSlug, resource_id: resourceId },
      { onConflict: "module_slug,resource_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  return { ok: true };
}

export async function unlinkResourceFromModule(
  moduleSlug: string,
  resourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) return { ok: true };
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("module_resources")
    .delete()
    .eq("module_slug", moduleSlug)
    .eq("resource_id", resourceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  return { ok: true };
}
