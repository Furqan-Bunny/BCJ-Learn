// Storage helpers for the three Supabase buckets.
//
//   • module-content (private) — manuals, slides, videos. Signed URLs on read.
//   • branding      (public)  — BCJ logo + brand assets.
//   • avatars       (public)  — user profile pictures.

import { createClient } from "@/lib/supabase/client";

const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

/** Upload a file into the module-content bucket. Returns the storage key. */
export async function uploadModuleContent(
  moduleSlug: string,
  lessonId: string,
  file: File,
): Promise<{ path: string }> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${moduleSlug}/${lessonId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("module-content")
    .upload(path, file, { upsert: false, cacheControl: "3600" });
  if (error) throw error;
  return { path };
}

/** Generate a short-lived signed URL for reading from the private bucket. */
export async function signedUrlForContent(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("module-content")
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

/** Upload a branding asset (logo etc). Returns the public URL. */
export async function uploadBrandingAsset(file: File, name: string): Promise<{ url: string; path: string }> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${name}.${ext}`;
  const { error } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}`, path };
}

/** Upload the current user's avatar. Returns the cache-busted public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<{ url: string }> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}` };
}
