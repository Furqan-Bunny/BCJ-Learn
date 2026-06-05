"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Save the signed-in user's language preference (English / Spanish). */
export async function setLocale(locale: "en" | "es"): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("profiles").update({ locale }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  // Re-render the whole app shell so the new language takes effect everywhere.
  revalidatePath("/", "layout");
  return { ok: true };
}
