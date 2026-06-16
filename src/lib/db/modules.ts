// Modules — DB queries with shape matching src/data/modules.ts.

import { dbClient } from "@/lib/supabase/db-client";
import { pickLocale, type Locale } from "@/lib/i18n";
import type { ModuleDef, Lesson, LessonContent, ContentType, ModuleStatus } from "@/types";

interface ModuleRow {
  slug: string;
  number: number;
  title: string;
  description: string;
  title_es: string | null;
  description_es: string | null;
  scheduled_month: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  timezone: string | null;
  created_at: string | null;
  content_version: number | null;
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
  title_es: string | null;
  description_es: string | null;
  duration_minutes: number;
}

interface LessonContentRow {
  id: string;
  lesson_id: string;
  type: ContentType;
  title: string;
  title_es: string | null;
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
    presentationHidden?: boolean;
  } | null;
  order: number;
}

function rowToModuleDef(
  r: ModuleRow,
  ownerTeacherIds: string[],
  lessons: Lesson[],
  locale: Locale,
): ModuleDef {
  return {
    slug: r.slug,
    number: r.number,
    title: pickLocale(r.title, r.title_es, locale),
    description: pickLocale(r.description, r.description_es, locale),
    scheduledMonth: r.scheduled_month ?? "",
    scheduledDate: r.scheduled_date ?? "",
    scheduledTime: r.scheduled_time ?? "",
    timezone: r.timezone ?? "",
    createdAt: r.created_at ?? undefined,
    contentVersion: r.content_version ?? 1,
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

function rowToLesson(r: LessonRow, contents: LessonContent[], locale: Locale): Lesson {
  return {
    id: r.id,
    moduleSlug: r.module_slug,
    order: r.order,
    title: pickLocale(r.title, r.title_es, locale),
    description: pickLocale(r.description, r.description_es, locale),
    durationMinutes: r.duration_minutes,
    contents,
  };
}

function rowToLessonContent(r: LessonContentRow, locale: Locale): LessonContent {
  const meta = r.metadata ?? {};
  return {
    id: r.id,
    type: r.type,
    title: pickLocale(r.title, r.title_es, locale),
    durationMinutes: r.duration_minutes ?? undefined,
    videoUrl: r.video_url ?? undefined,
    videoThumbnail: meta.videoThumbnail,
    documentPages: meta.documentPages,
    slides: meta.slides,
    externalUrl: r.external_url ?? undefined,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    storagePath: r.storage_path ?? undefined,
    presentationHidden: meta.presentationHidden ?? undefined,
  };
}

export async function listModules(locale: Locale = "en"): Promise<ModuleDef[]> {
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
    list.push(rowToLessonContent(c, locale));
    contentsByLesson.set(c.lesson_id, list);
  }

  const lessonsBySlug = new Map<string, Lesson[]>();
  for (const l of (lessonRows ?? []) as LessonRow[]) {
    const list = lessonsBySlug.get(l.module_slug) ?? [];
    list.push(rowToLesson(l, contentsByLesson.get(l.id) ?? [], locale));
    lessonsBySlug.set(l.module_slug, list);
  }

  return (modRows ?? []).map((row) => {
    const r = row as ModuleRow;
    return rowToModuleDef(r, ownersBySlug.get(r.slug) ?? [], lessonsBySlug.get(r.slug) ?? [], locale);
  });
}

export async function getModule(slug: string, locale: Locale = "en"): Promise<ModuleDef | null> {
  const all = await listModules(locale);
  return all.find((m) => m.slug === slug) ?? null;
}

// Modules a given user is assigned to / has engaged with — used to surface a
// "Training assigned to you" section for non-managers (Department Leads/Admins)
// who don't have a manager dashboard. A module qualifies if the user is invited
// to one of its deliveries OR has any attempt on it. Published modules only.
export async function listModulesAssignedToUser(userId: string, locale: Locale = "en"): Promise<ModuleDef[]> {
  const sb = await dbClient();
  const [{ data: inviteeRows }, { data: attemptRows }] = await Promise.all([
    sb.from("module_invitees").select("delivery_id").eq("manager_id", userId),
    sb.from("attempts").select("module_slug").eq("manager_id", userId),
  ]);

  const deliveryIds = Array.from(
    new Set(((inviteeRows ?? []) as { delivery_id: string }[]).map((r) => r.delivery_id)),
  );
  const slugs = new Set<string>(
    ((attemptRows ?? []) as { module_slug: string }[]).map((r) => r.module_slug),
  );
  if (deliveryIds.length > 0) {
    const { data: deliveryRows } = await sb
      .from("module_deliveries")
      .select("module_slug")
      .in("id", deliveryIds);
    for (const d of (deliveryRows ?? []) as { module_slug: string }[]) slugs.add(d.module_slug);
  }
  if (slugs.size === 0) return [];

  const all = await listModules(locale);
  return all.filter((m) => slugs.has(m.slug) && m.status === "published");
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
  changedByName: string | null;
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
  const rows = (data ?? []) as ModuleContentVersionRow[];

  // Resolve editor ids -> names in one query.
  const editorIds = Array.from(new Set(rows.map((r) => r.changed_by).filter((x): x is string => !!x)));
  const names = new Map<string, string>();
  if (editorIds.length > 0) {
    const { data: people } = await sb.from("profiles").select("id, name").in("id", editorIds);
    for (const p of (people ?? []) as { id: string; name: string }[]) names.set(p.id, p.name);
  }

  return rows.map((r) => ({
    versionNumber: r.version_number,
    changeReason: r.change_reason,
    changedBy: r.changed_by,
    changedByName: r.changed_by ? names.get(r.changed_by) ?? null : null,
    createdAt: r.created_at,
    lessons: r.snapshot ?? [],
  }));
}
