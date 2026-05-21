"use server";

// Video watch-progress — server actions. Records a manager's playback position
// and completion for uploaded lesson videos so the viewer can resume and
// completion can be reported. Demo mode no-ops (no real session).

import { createClient } from "@/lib/supabase/server";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface SaveVideoProgressInput {
  lessonContentId: string;
  moduleSlug?: string | null;
  positionSec: number;
  durationSec: number;
}

export async function saveVideoProgress(
  input: SaveVideoProgressInput,
): Promise<{ ok: boolean }> {
  if (DEMO_MODE) return { ok: true };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false };

  const duration = Math.max(0, Math.round(input.durationSec));
  const position = Math.max(0, Math.round(input.positionSec));
  const pct = duration > 0 ? Math.min(100, Math.round((position / duration) * 10000) / 100) : 0;

  // Build the row. Only set completed_at when crossing the threshold so a later
  // re-watch from the start never clears an existing completion (omitted columns
  // are preserved on upsert conflict).
  const row: Record<string, unknown> = {
    manager_id: user.id,
    lesson_content_id: input.lessonContentId,
    module_slug: input.moduleSlug ?? null,
    position_sec: position,
    duration_sec: duration,
    watch_pct: pct,
    updated_at: new Date().toISOString(),
  };
  if (pct >= 90) row.completed_at = new Date().toISOString();

  const { error } = await sb
    .from("video_progress")
    .upsert(row, { onConflict: "manager_id,lesson_content_id" });
  if (error) return { ok: false };
  return { ok: true };
}

export async function getVideoProgress(
  lessonContentId: string,
): Promise<{ positionSec: number; completed: boolean } | null> {
  if (DEMO_MODE) return null;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("video_progress")
    .select("position_sec, completed_at")
    .eq("manager_id", user.id)
    .eq("lesson_content_id", lessonContentId)
    .maybeSingle();
  if (!data) return null;
  const r = data as { position_sec: number; completed_at: string | null };
  return { positionSec: r.position_sec, completed: !!r.completed_at };
}
