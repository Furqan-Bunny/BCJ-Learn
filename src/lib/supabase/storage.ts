// Storage helpers for the three Supabase buckets.
//
//   • module-content (private) — manuals, slides, videos. Signed URLs on read.
//   • branding      (public)  — BCJ logo + brand assets.
//   • avatars       (public)  — user profile pictures.

import { createClient } from "@/lib/supabase/client";
import * as tus from "tus-js-client";

const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

// Supabase's resumable (TUS) endpoint requires chunks of exactly 6 MB.
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;

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

/**
 * Resumable upload into the module-content bucket via the Supabase TUS endpoint.
 * Reports real progress, auto-retries transient failures, and resumes in 6 MB
 * chunks — suited to large training videos. `onProgress` gets 0–100; `signal`
 * cancels the upload.
 */
export async function uploadModuleContentResumable(
  moduleSlug: string,
  lessonId: string,
  file: File,
  opts?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
): Promise<{ path: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const accessToken = session?.access_token ?? anonKey;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${moduleSlug}/${lessonId}/${Date.now()}-${safeName}`;

  return new Promise<{ path: string }>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "x-upsert": "false",
      },
      chunkSize: RESUMABLE_CHUNK_SIZE,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "module-content",
        objectName: path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: (err) => reject(err),
      onProgress: (sent, total) => {
        if (opts?.onProgress && total > 0) {
          opts.onProgress(Math.round((sent / total) * 100));
        }
      },
      onSuccess: () => resolve({ path }),
    });

    if (opts?.signal) {
      if (opts.signal.aborted) {
        upload.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      opts.signal.addEventListener("abort", () => {
        upload.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      });
    }

    // Resume a prior interrupted upload of the same file if one exists.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
}

/** Upload an SOP / resource file into the module-content bucket. */
export async function uploadResourceFile(file: File): Promise<{ path: string }> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `sop/${Date.now()}-${safeName}`;
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
