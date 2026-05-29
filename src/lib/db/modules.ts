// Modules — DB queries with shape matching src/data/modules.ts.

import { dbClient } from "@/lib/supabase/db-client";
import type { ModuleDef, Lesson, LessonContent, ContentType, ModuleStatus } from "@/types";

interface ModuleRow {
  slug: string;
  number: number;
  title: string;
  description: string;
  scheduled_month: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  created_at: string | null;
  status: ModuleStatus;
  pass_threshold: number;
  question_count: number;
  time_limit_minutes: number | null;
  questions_approved: number;
  questions_total: number;
  flashcards: { front: string; back: string }[] | null;
}

interface LessonRow {
  id: string;
  module_slug: string;
  order: number;
  title: string;
  description: string;
  duration_minutes: number;
}

interface LessonContentRow {
  id: string;
  lesson_id: string;
  type: ContentType;
  title: string;
  duration_minutes: number | null;
  video_url: string | null;
  storage_path: string | null;
  external_url: string | null;
  metadata: {
    videoThumbnail?: string;
    documentPages?: string[];
    slides?: { title: string; bullets: string[] }[];
    fileName?: string;
    fileSize?: string;
  } | null;
  order: number;
}

function rowToModuleDef(
  r: ModuleRow,
  ownerTeacherIds: string[],
  lessons: Lesson[],
): ModuleDef {
  return {
    slug: r.slug,
    number: r.number,
    title: r.title,
    description: r.description,
    scheduledMonth: r.scheduled_month ?? "",
    scheduledDate: r.scheduled_date ?? "",
    scheduledTime: r.scheduled_time ?? "",
    createdAt: r.created_at ?? undefined,
    ownerTeacherIds,
    status: r.status,
    passThreshold: r.pass_threshold,
    questionCount: r.question_count,
    timeLimitMinutes: r.time_limit_minutes,
    questionsApproved: r.questions_approved,
    questionsTotal: r.questions_total,
    lessons,
    flashcards: r.flashcards ?? [],
  };
}

function rowToLesson(r: LessonRow, contents: LessonContent[]): Lesson {
  return {
    id: r.id,
    moduleSlug: r.module_slug,
    order: r.order,
    title: r.title,
    description: r.description,
    durationMinutes: r.duration_minutes,
    contents,
  };
}

function rowToLessonContent(r: LessonContentRow): LessonContent {
  const meta = r.metadata ?? {};
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    durationMinutes: r.duration_minutes ?? undefined,
    videoUrl: r.video_url ?? undefined,
    videoThumbnail: meta.videoThumbnail,
    documentPages: meta.documentPages,
    slides: meta.slides,
    externalUrl: r.external_url ?? undefined,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    storagePath: r.storage_path ?? undefined,
  };
}

export async function listModules(): Promise<ModuleDef[]> {
  const sb = await dbClient();
  const [
    { data: modRows },
    { data: ownerRows },
    { data: lessonRows },
    { data: contentRows },
  ] = await Promise.all([
    sb.from("modules").select("*").order("number"),
    sb.from("module_owners").select("module_slug, teacher_id, is_primary"),
    sb.from("lessons").select("*").order("order"),
    sb.from("lesson_contents").select("*").order("order"),
  ]);

  const ownersBySlug = new Map<string, string[]>();
  for (const o of (ownerRows ?? []) as { module_slug: string; teacher_id: string; is_primary: boolean }[]) {
    const list = ownersBySlug.get(o.module_slug) ?? [];
    // Primary first
    if (o.is_primary) list.unshift(o.teacher_id);
    else list.push(o.teacher_id);
    ownersBySlug.set(o.module_slug, list);
  }

  const contentsByLesson = new Map<string, LessonContent[]>();
  for (const c of (contentRows ?? []) as LessonContentRow[]) {
    const list = contentsByLesson.get(c.lesson_id) ?? [];
    list.push(rowToLessonContent(c));
    contentsByLesson.set(c.lesson_id, list);
  }

  const lessonsBySlug = new Map<string, Lesson[]>();
  for (const l of (lessonRows ?? []) as LessonRow[]) {
    const list = lessonsBySlug.get(l.module_slug) ?? [];
    list.push(rowToLesson(l, contentsByLesson.get(l.id) ?? []));
    lessonsBySlug.set(l.module_slug, list);
  }

  return (modRows ?? []).map((row) => {
    const r = row as ModuleRow;
    return rowToModuleDef(r, ownersBySlug.get(r.slug) ?? [], lessonsBySlug.get(r.slug) ?? []);
  });
}

export async function getModule(slug: string): Promise<ModuleDef | null> {
  const all = await listModules();
  return all.find((m) => m.slug === slug) ?? null;
}

export async function moduleTotalMinutes(slug: string): Promise<number> {
  const m = await getModule(slug);
  if (!m) return 0;
  return m.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
}

export async function moduleContentCounts(slug: string): Promise<{ videos: number; documents: number; slides: number; links: number }> {
  const m = await getModule(slug);
  if (!m) return { videos: 0, documents: 0, slides: 0, links: 0 };
  const all = m.lessons.flatMap((l) => l.contents);
  return {
    videos: all.filter((c) => c.type === "video").length,
    documents: all.filter((c) => c.type === "document").length,
    slides: all.filter((c) => c.type === "slides").length,
    links: all.filter((c) => c.type === "link").length,
  };
}

// ─── Content version history ────────────────────────────────────────────

export interface ModuleContentVersion {
  versionNumber: number;
  changeReason: string;
  changedBy: string | null;
  createdAt: string;
  lessons: Lesson[];
}

interface ModuleContentVersionRow {
  version_number: number;
  change_reason: string;
  changed_by: string | null;
  created_at: string;
  snapshot: Lesson[] | null;
}

export async function listModuleContentVersions(slug: string): Promise<ModuleContentVersion[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("module_content_versions")
    .select("version_number, change_reason, changed_by, created_at, snapshot")
    .eq("module_slug", slug)
    .order("version_number", { ascending: false });
  return ((data ?? []) as ModuleContentVersionRow[]).map((r) => ({
    versionNumber: r.version_number,
    changeReason: r.change_reason,
    changedBy: r.changed_by,
    createdAt: r.created_at,
    lessons: r.snapshot ?? [],
  }));
}
