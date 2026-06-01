"use server";

// Admin actions to link / unlink SOPs (resources) to a training module. The
// employee module page reads the link to decide which SOPs to gate the module
// behind.

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function linkResourceToModule(
  moduleSlug: string,
  resourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) return { ok: true };
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
