"use server";

// AI question authoring — server actions.
//
// Scope (per SOW + v1.4):
//   - Department Lead/Admin uploads source content
//   - On demand they click "Generate questions with AI"
//   - Claude drafts 50 first-attempt + 30 easier retake questions
//   - All start status='pending'; a human approves/edits/rejects/regenerates
//
// All calls are server-side; the API key never reaches the browser. RLS lets
// admin/teacher-owner modify their module's questions; this code mirrors that
// authorisation explicitly so errors are user-friendly.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { pushInAppNotification } from "@/lib/notifications/push";
import { openaiClient, CHAT_MODEL } from "@/lib/ai/openai";
import { extractTextForContent } from "@/lib/ai/extract";
import {
  QUESTION_GEN_SYSTEM,
  questionGenUserPrompt,
  questionRegenSystem,
  questionRegenUserPrompt,
  SUMMARIZE_SYSTEM,
  summarizeUserPrompt,
  QUESTION_TRANSLATE_SYSTEM,
  questionTranslateUserPrompt,
  CONTENT_TRANSLATE_SYSTEM,
  contentTranslateUserPrompt,
} from "@/lib/ai/prompts";
import { revalidatePath } from "next/cache";
import { listQuestionVersions, type QuestionVersion } from "@/lib/db/questions";
import type { QuestionPool, Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const FIRST_ATTEMPT_COUNT = 50;
const RETAKE_COUNT = 30;

// Snapshot a question's current text + options into question_versions before it
// changes, so prior versions can be reviewed and restored. Best-effort: never
// blocks the calling action (e.g. if migration 0007 hasn't been applied yet).
async function snapshotQuestion(
  admin: ReturnType<typeof createAdminClient>,
  questionId: string,
  changeReason: string,
  userId: string | null,
): Promise<void> {
  try {
    const { data: qRow } = await admin
      .from("questions")
      .select("text, explanation, status")
      .eq("id", questionId)
      .maybeSingle();
    if (!qRow) return;
    const q = qRow as { text: string; explanation: string | null; status: string };

    const { data: optRows } = await admin
      .from("question_options")
      .select("text, correct, order")
      .eq("question_id", questionId)
      .order("order");
    const options = (optRows ?? []) as { text: string; correct: boolean; order: number }[];

    const { data: maxRow } = await admin
      .from("question_versions")
      .select("version_number")
      .eq("question_id", questionId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((maxRow as { version_number?: number } | null)?.version_number ?? 0) + 1;

    await admin.from("question_versions").insert({
      question_id: questionId,
      version_number: nextVersion,
      text: q.text,
      explanation: q.explanation,
      options,
      status: q.status,
      change_reason: changeReason,
      changed_by: userId,
    });
  } catch {
    // Non-fatal: versioning is additive; never break the primary edit/approve.
  }
}

interface AuthInfo {
  ok: true;
  userId: string;
  userName: string;
  role: Role;
}

async function requireAdminOrModuleOwner(
  moduleSlug: string,
): Promise<AuthInfo | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await sb.from("profiles").select("role, name").eq("id", user.id).single();
  const p = profile as { role?: Role; name?: string } | null;
  if (!p) return { ok: false, error: "Profile not found" };

  if (p.role === "admin") return { ok: true, userId: user.id, userName: p.name ?? "", role: "admin" };
  if (p.role !== "teacher") return { ok: false, error: "Admin or teacher role required" };

  const { data: owner } = await sb
    .from("module_owners")
    .select("teacher_id")
    .eq("module_slug", moduleSlug)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!owner) return { ok: false, error: "You don't own this module" };

  return { ok: true, userId: user.id, userName: p.name ?? "", role: "teacher" };
}

// ─── Generate questions ────────────────────────────────────────────────

interface DraftQuestion {
  text: string;
  options: { text: string; correct: boolean }[];
  explanation: string;
}

function extractJsonArray(raw: string): DraftQuestion[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parsed as DraftQuestion[];
  const qs = (parsed as { questions?: unknown } | null)?.questions;
  if (Array.isArray(qs)) return qs as DraftQuestion[];
  throw new Error("Expected a questions array");
}

function extractJsonObject(raw: string): DraftQuestion {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as DraftQuestion;
}

async function callLlmForBatch(
  content: string,
  pool: QuestionPool,
  count: number,
  avoidTexts?: string[],
): Promise<DraftQuestion[]> {
  const openai = openaiClient();
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: QUESTION_GEN_SYSTEM },
      { role: "user", content: questionGenUserPrompt(content, pool, count, avoidTexts) },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  return extractJsonArray(text);
}

// The module content_version in effect right now — every generated question is
// stamped with it so the question bank can flag ones authored against older content.
async function currentContentVersion(
  admin: ReturnType<typeof createAdminClient>,
  moduleSlug: string,
): Promise<number> {
  const { data } = await admin.from("modules").select("content_version").eq("slug", moduleSlug).single();
  return (data as { content_version?: number } | null)?.content_version ?? 1;
}

async function insertDrafts(
  admin: ReturnType<typeof createAdminClient>,
  moduleSlug: string,
  drafts: (DraftQuestion & { pool: QuestionPool })[],
  userId: string,
  contentVersion: number,
): Promise<number> {
  let created = 0;
  for (const draft of drafts) {
    if (!draft.text || !Array.isArray(draft.options) || draft.options.length !== 4) continue;
    const { data: insertedQ, error: qErr } = await admin
      .from("questions")
      .insert({
        module_slug: moduleSlug,
        pool: draft.pool,
        status: "pending",
        text: draft.text,
        explanation: draft.explanation ?? null,
        generated_by_ai: true,
        source_content_version: contentVersion,
      })
      .select("id")
      .single();
    if (qErr || !insertedQ) continue;
    const qId = (insertedQ as { id: string }).id;
    const optionRows = draft.options.map((o, i) => ({ question_id: qId, text: o.text, correct: !!o.correct, order: i }));
    const { error: oErr } = await admin.from("question_options").insert(optionRows);
    if (oErr) { await admin.from("questions").delete().eq("id", qId); continue; }
    await snapshotQuestion(admin, qId, "initial", userId);
    created++;
  }
  return created;
}

async function refreshQuestionCounts(admin: ReturnType<typeof createAdminClient>, moduleSlug: string) {
  const { count } = await admin
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("module_slug", moduleSlug);
  await admin.from("modules").update({ questions_total: count ?? 0 }).eq("slug", moduleSlug);
  revalidatePath(`/teacher/modules/${moduleSlug}/questions`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/admin/questions`);
}

// ─── Staged generation pipeline (client-drivable for live progress) ──────

// Stage 1 — extract text from every file, cache it, store the combined source.
export async function extractModuleSources(moduleSlug: string): Promise<
  | { ok: true; totalChars: number; items: { title: string; type: string; chars: number; note?: string }[] }
  | { ok: false; error: string }
> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: lessonsData } = await admin
    .from("lessons")
    .select("title, description, lesson_contents(id, type, title, metadata, storage_path)")
    .eq("module_slug", moduleSlug)
    .order("order");
  const lessons = (lessonsData ?? []) as {
    title: string;
    description: string;
    lesson_contents: { id: string; type: string; title: string; metadata: unknown; storage_path: string | null }[];
  }[];
  if (lessons.length === 0) return { ok: false, error: "This module has no lessons yet — add content first." };

  const parts: string[] = [];
  const items: { title: string; type: string; chars: number; note?: string }[] = [];
  for (const l of lessons) {
    parts.push(`## ${l.title}\n${l.description}`);
    for (const c of l.lesson_contents ?? []) {
      const res = await extractTextForContent({
        type: c.type,
        title: c.title,
        storagePath: c.storage_path,
        fileName: (c.metadata as { fileName?: string } | null)?.fileName ?? null,
        metadata: c.metadata,
      });
      const text = res.text.trim();
      if (text) {
        parts.push(`### ${c.title}\n${text}`);
        const prevMeta = (c.metadata as Record<string, unknown> | null) ?? {};
        await admin.from("lesson_contents").update({ metadata: { ...prevMeta, extractedText: text } }).eq("id", c.id);
      }
      items.push({ title: c.title, type: c.type, chars: text.length, note: res.note });
    }
  }
  let combined = parts.join("\n\n");
  if (combined.length > 80_000) combined = combined.slice(0, 80_000);
  await admin.from("modules").update({ ai_source_text: combined }).eq("slug", moduleSlug);

  return { ok: true, totalChars: combined.trim().length, items };
}

// Stage 2 — condense long/multi-source material into a focused study summary.
export async function summarizeModule(moduleSlug: string): Promise<{ ok: boolean; error?: string; summarized?: boolean }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, summarized: false };

  const admin = createAdminClient();
  const { data } = await admin.from("modules").select("ai_source_text").eq("slug", moduleSlug).single();
  const source = (data as { ai_source_text?: string } | null)?.ai_source_text ?? "";
  if (source.trim().length < 6000) return { ok: true, summarized: false };

  try {
    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SUMMARIZE_SYSTEM },
        { role: "user", content: summarizeUserPrompt(source) },
      ],
    });
    const summary = res.choices[0]?.message?.content?.trim();
    if (summary && summary.length > 200) {
      await admin.from("modules").update({ ai_source_text: summary }).eq("slug", moduleSlug);
      return { ok: true, summarized: true };
    }
  } catch (err) {
    return { ok: true, summarized: false, error: (err as Error).message };
  }
  return { ok: true, summarized: false };
}

// Normalize question text for duplicate detection (case/punctuation/space-insensitive).
function normalizeText(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

// Fetch existing question texts for a module (optionally a pool) for dedup.
async function existingQuestionTexts(
  admin: ReturnType<typeof createAdminClient>,
  moduleSlug: string,
  pool?: QuestionPool,
): Promise<{ raw: string[]; normalized: Set<string> }> {
  let q = admin.from("questions").select("text").eq("module_slug", moduleSlug);
  if (pool) q = q.eq("pool", pool);
  const { data } = await q;
  const raw = ((data ?? []) as { text: string }[]).map((r) => r.text);
  return { raw, normalized: new Set(raw.map(normalizeText)) };
}

// Stage 3 — generate one pool's questions from the cached source.
export async function generateQuestionBatch(
  moduleSlug: string,
  pool: QuestionPool,
): Promise<{ ok: boolean; error?: string; created?: number }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data } = await admin.from("modules").select("ai_source_text").eq("slug", moduleSlug).single();
  const source = (data as { ai_source_text?: string } | null)?.ai_source_text ?? "";
  if (source.trim().length < 200) {
    return { ok: false, error: "No readable content found. Upload a document/video with real content first." };
  }
  if (DEMO_MODE) return { ok: true, created: 0 };

  const count = pool === "retake" ? RETAKE_COUNT : FIRST_ATTEMPT_COUNT;
  const existing = await existingQuestionTexts(admin, moduleSlug, pool);
  let drafts: DraftQuestion[];
  try {
    drafts = await callLlmForBatch(source, pool, count, existing.raw);
  } catch (err) {
    return { ok: false, error: `AI error: ${(err as Error).message}` };
  }
  // Drop duplicates — against existing questions and within this batch.
  const seen = new Set(existing.normalized);
  const deduped = drafts.filter((d) => {
    const n = normalizeText(d.text ?? "");
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  const cv = await currentContentVersion(admin, moduleSlug);
  const created = await insertDrafts(admin, moduleSlug, deduped.map((q) => ({ ...q, pool })), guard.userId, cv);
  await refreshQuestionCounts(admin, moduleSlug);
  return { ok: true, created };
}

// Remove AI-generated questions for a module. By default only un-curated ones
// (status pending/rejected) are deleted — human-approved/edited questions are
// kept (they just get tagged "older content" by the version stamp). Used by the
// "content changed" prompt and the replace-mode generation.
export async function clearGeneratedQuestions(
  moduleSlug: string,
  opts?: { onlyUnapproved?: boolean },
): Promise<{ ok: boolean; error?: string; removed?: number }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, removed: 0 };

  const onlyUnapproved = opts?.onlyUnapproved ?? true;
  const admin = createAdminClient();
  let del = admin.from("questions").delete({ count: "exact" }).eq("module_slug", moduleSlug).eq("generated_by_ai", true);
  if (onlyUnapproved) del = del.in("status", ["pending", "rejected"]);
  const { count, error } = await del;
  if (error) return { ok: false, error: error.message };
  await refreshQuestionCounts(admin, moduleSlug);
  return { ok: true, removed: count ?? 0 };
}

// Delete every "older content" question for a module — i.e. any question whose
// source_content_version is below the NEWEST version present (the same rule the
// question bank uses for the "Older content" badge). Removes ALL of them,
// including approved/edited ones (the UI confirms first). Question_options and
// attempt_answers cascade on delete.
export async function deleteOlderContentQuestions(
  moduleSlug: string,
): Promise<{ ok: boolean; error?: string; removed?: number }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, removed: 0 };

  const admin = createAdminClient();

  // Newest content version that actually has questions.
  const { data: verRows } = await admin
    .from("questions")
    .select("source_content_version")
    .eq("module_slug", moduleSlug)
    .not("source_content_version", "is", null)
    .order("source_content_version", { ascending: false })
    .limit(1);
  const maxV = (verRows?.[0] as { source_content_version?: number } | undefined)?.source_content_version;
  if (maxV == null) return { ok: true, removed: 0 };

  const { count, error } = await admin
    .from("questions")
    .delete({ count: "exact" })
    .eq("module_slug", moduleSlug)
    .not("source_content_version", "is", null)
    .lt("source_content_version", maxV);
  if (error) return { ok: false, error: error.message };

  // Recompute total AND approved (approved questions may have been removed).
  const [{ count: total }, { count: approved }] = await Promise.all([
    admin.from("questions").select("*", { count: "exact", head: true }).eq("module_slug", moduleSlug),
    admin.from("questions").select("*", { count: "exact", head: true }).eq("module_slug", moduleSlug).in("status", ["approved", "edited"]),
  ]);
  await admin.from("modules").update({ questions_total: total ?? 0, questions_approved: approved ?? 0 }).eq("slug", moduleSlug);

  revalidatePath(`/teacher/modules/${moduleSlug}/questions`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/admin/questions`);
  return { ok: true, removed: count ?? 0 };
}

// Returns drafts WITHOUT inserting — powers the interactive one-by-one review.
export async function generateQuestionDrafts(
  moduleSlug: string,
  pool: QuestionPool,
  count: number,
  avoidTexts: string[] = [],
): Promise<{ ok: boolean; error?: string; drafts?: DraftQuestion[] }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data } = await admin.from("modules").select("ai_source_text").eq("slug", moduleSlug).single();
  const source = (data as { ai_source_text?: string } | null)?.ai_source_text ?? "";
  if (source.trim().length < 200) {
    return { ok: false, error: "No readable content found. Add a document/video with real content first." };
  }
  if (DEMO_MODE) return { ok: true, drafts: [] };

  const existing = await existingQuestionTexts(admin, moduleSlug, pool);
  const seen = new Set(existing.normalized);
  for (const t of avoidTexts) seen.add(normalizeText(t));
  try {
    const drafts = await callLlmForBatch(source, pool, count, [...avoidTexts, ...existing.raw]);
    const valid = drafts.filter((d) => {
      if (!d.text || !Array.isArray(d.options) || d.options.length !== 4) return false;
      const n = normalizeText(d.text);
      if (seen.has(n)) return false; // skip duplicates of existing/already-seen
      seen.add(n);
      return true;
    });
    return { ok: true, drafts: valid };
  } catch (err) {
    return { ok: false, error: `AI error: ${(err as Error).message}` };
  }
}

// Inserts a single admin-approved draft (status 'approved') + refreshes counts.
export async function commitQuestionDraft(
  moduleSlug: string,
  pool: QuestionPool,
  draft: DraftQuestion,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!draft.text || !Array.isArray(draft.options) || draft.options.length !== 4) {
    return { ok: false, error: "Invalid question" };
  }
  if (DEMO_MODE) return { ok: true, id: "demo" };

  const admin = createAdminClient();
  const existing = await existingQuestionTexts(admin, moduleSlug, pool);
  if (existing.normalized.has(normalizeText(draft.text))) {
    return { ok: false, error: "That question already exists in this module — skipped to avoid a duplicate." };
  }
  const cv = await currentContentVersion(admin, moduleSlug);
  const { data: insertedQ, error: qErr } = await admin
    .from("questions")
    .insert({
      module_slug: moduleSlug,
      pool,
      status: "approved",
      text: draft.text,
      explanation: draft.explanation ?? null,
      generated_by_ai: true,
      source_content_version: cv,
      approved_at: new Date().toISOString(),
      approved_by: guard.userId,
    })
    .select("id")
    .single();
  if (qErr || !insertedQ) return { ok: false, error: qErr?.message ?? "Could not save question" };
  const qId = (insertedQ as { id: string }).id;

  const optionRows = draft.options.map((o, i) => ({ question_id: qId, text: o.text, correct: !!o.correct, order: i }));
  const { error: oErr } = await admin.from("question_options").insert(optionRows);
  if (oErr) { await admin.from("questions").delete().eq("id", qId); return { ok: false, error: oErr.message }; }

  await snapshotQuestion(admin, qId, "initial", guard.userId);

  const [{ count: total }, { count: approved }] = await Promise.all([
    admin.from("questions").select("*", { count: "exact", head: true }).eq("module_slug", moduleSlug),
    admin.from("questions").select("*", { count: "exact", head: true }).eq("module_slug", moduleSlug).in("status", ["approved", "edited"]),
  ]);
  await admin.from("modules").update({ questions_total: total ?? 0, questions_approved: approved ?? 0 }).eq("slug", moduleSlug);

  revalidatePath(`/teacher/modules/${moduleSlug}/questions`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/admin/questions`);

  // Cache a Spanish translation in the background (English is the fallback).
  void translateQuestionToSpanish(qId).catch(() => {});
  return { ok: true, id: qId };
}

// One-shot generation (used by the "Generate with AI" button) — composes the stages.
// mode 'replace' first clears un-curated AI questions (so editing content + regenerating
// doesn't keep piling old questions on); 'append' (default) keeps the existing behaviour.
export async function generateQuestions(
  moduleSlug: string,
  mode: "append" | "replace" = "append",
): Promise<
  | { ok: true; created: number; removed?: number }
  | { ok: false; error: string }
> {
  let removed = 0;
  if (mode === "replace") {
    const cleared = await clearGeneratedQuestions(moduleSlug, { onlyUnapproved: true });
    if (!cleared.ok) return { ok: false, error: cleared.error ?? "Could not clear old questions" };
    removed = cleared.removed ?? 0;
  }
  const ex = await extractModuleSources(moduleSlug);
  if (!ex.ok) return ex;
  if (ex.totalChars < 200) {
    return { ok: false, error: "No readable content found in this module's files. Upload a Word/PDF/text document (or a short video) with real content, then try again." };
  }
  await summarizeModule(moduleSlug);
  const a = await generateQuestionBatch(moduleSlug, "first-attempt");
  if (!a.ok) return { ok: false, error: a.error ?? "Generation failed" };
  const b = await generateQuestionBatch(moduleSlug, "retake");
  if (!b.ok) return { ok: false, error: b.error ?? "Generation failed" };
  return { ok: true, created: (a.created ?? 0) + (b.created ?? 0), removed };
}

// ─── Approve question ──────────────────────────────────────────────────

export async function approveQuestion(questionId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Need module slug for guard.
  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("questions")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", questionId);
  if (error) return { ok: false, error: error.message };

  // Record the approved content as a version milestone.
  await snapshotQuestion(admin, questionId, "approved", user.id);

  // Cache a Spanish translation in the background (English is the fallback).
  void translateQuestionToSpanish(questionId).catch(() => {});

  // Refresh approved count on module row.
  const { count: approvedCount } = await admin
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("module_slug", slug)
    .in("status", ["approved", "edited"]);
  await admin.from("modules").update({ questions_approved: approvedCount ?? 0 }).eq("slug", slug);

  await admin.from("activity").insert({
    kind: "questions_approved",
    actor_id: user.id,
    target_id: null,
    message: `Approved a question for module ${slug}`,
  });

  // Notify the module's owning teacher(s) — skip the actor (they already know).
  const { data: ownerRows } = await admin
    .from("module_owners")
    .select("teacher_id")
    .eq("module_slug", slug);
  const { data: modRow } = await admin
    .from("modules")
    .select("title")
    .eq("slug", slug)
    .maybeSingle();
  const moduleTitle = (modRow as { title?: string } | null)?.title ?? slug;
  const ownerIds = ((ownerRows ?? []) as { teacher_id: string }[])
    .map((r) => r.teacher_id)
    .filter((id) => id !== user.id);

  await Promise.all(
    ownerIds.map((teacherId) =>
      pushInAppNotification({
        recipientId: teacherId,
        kind: "result",
        subject: `Question approved — ${moduleTitle}`,
        preview: `A question in your ${moduleTitle} bank was approved.`,
        href: `/teacher/modules/${slug}/questions`,
      }),
    ),
  );

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}

// ─── Reject question ───────────────────────────────────────────────────

export async function rejectQuestion(questionId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { error } = await admin.from("questions").update({ status: "rejected" }).eq("id", questionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}

// ─── Regenerate a single question ──────────────────────────────────────

export async function regenerateQuestion(questionId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: qRow } = await sb
    .from("questions")
    .select("module_slug, text")
    .eq("id", questionId)
    .single();
  if (!qRow) return { ok: false, error: "Question not found" };
  const { module_slug: slug, text: originalText } = qRow as { module_slug: string; text: string };

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) {
    const admin = createAdminClient();
    await snapshotQuestion(admin, questionId, "regenerated", guard.userId);
    await admin
      .from("questions")
      .update({ text: `Re-drafted: ${originalText}`, status: "pending" })
      .eq("id", questionId);
    revalidatePath(`/teacher/modules/${slug}/questions`);
    return { ok: true };
  }

  let draft: DraftQuestion;
  try {
    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: questionRegenSystem() },
        { role: "user", content: questionRegenUserPrompt(originalText, null) },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    draft = extractJsonObject(text);
  } catch (err) {
    return { ok: false, error: `AI error: ${(err as Error).message}` };
  }

  const admin = createAdminClient();
  // Preserve the pre-regeneration version before overwriting.
  await snapshotQuestion(admin, questionId, "regenerated", guard.userId);
  await admin
    .from("questions")
    .update({
      text: draft.text,
      explanation: draft.explanation ?? null,
      status: "pending",
      approved_at: null,
      approved_by: null,
    })
    .eq("id", questionId);

  // Replace options.
  await admin.from("question_options").delete().eq("question_id", questionId);
  const optionRows = draft.options.map((o, i) => ({
    question_id: questionId,
    text: o.text,
    correct: !!o.correct,
    order: i,
  }));
  await admin.from("question_options").insert(optionRows);

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}

// ─── Classify a question into the first-attempt / retake pool ──────────

export async function setQuestionPool(
  questionId: string,
  pool: QuestionPool,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin.from("questions").update({ pool }).eq("id", questionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}

// ─── Duplicate a question into the retake pool (AI-reworded) ────────────
// Clones the source question into a NEW retake-pool row, rewording it so the
// retake set covers the same concept with different phrasing. Lands as
// "pending" so a lead reviews it before it goes live.
export async function duplicateQuestionToRetake(
  questionId: string,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const sb = await createClient();
  const { data: qRow } = await sb
    .from("questions")
    .select("module_slug, text, explanation")
    .eq("id", questionId)
    .single();
  if (!qRow) return { ok: false, error: "Question not found" };
  const { module_slug: slug, text: originalText } = qRow as {
    module_slug: string;
    text: string;
    explanation: string | null;
  };

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  // Build the reworded draft. In demo mode (no AI key) fall back to a copy.
  let draft: DraftQuestion;
  if (DEMO_MODE) {
    const { data: opts } = await sb
      .from("question_options")
      .select("text, correct, order")
      .eq("question_id", questionId)
      .order("order");
    draft = {
      text: `Retake: ${originalText}`,
      explanation: (qRow as { explanation: string | null }).explanation ?? "",
      options: ((opts ?? []) as { text: string; correct: boolean }[]).map((o) => ({ text: o.text, correct: o.correct })),
    };
  } else {
    try {
      const openai = openaiClient();
      const res = await openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: questionRegenSystem() },
          { role: "user", content: questionRegenUserPrompt(originalText, null) },
        ],
      });
      draft = extractJsonObject(res.choices[0]?.message?.content ?? "");
    } catch (err) {
      return { ok: false, error: `AI error: ${(err as Error).message}` };
    }
  }

  if (!draft.text || !Array.isArray(draft.options) || draft.options.length !== 4) {
    return { ok: false, error: "Could not build a valid retake question" };
  }

  // Reuse the standard draft-commit path, but land as pending for review.
  if (DEMO_MODE) return { ok: true, id: "demo" };
  const admin = createAdminClient();
  const { data: insertedQ, error: qErr } = await admin
    .from("questions")
    .insert({
      module_slug: slug,
      pool: "retake" as QuestionPool,
      status: "pending",
      text: draft.text,
      explanation: draft.explanation ?? null,
      generated_by_ai: true,
    })
    .select("id")
    .single();
  if (qErr || !insertedQ) return { ok: false, error: qErr?.message ?? "Could not save retake question" };
  const qId = (insertedQ as { id: string }).id;

  const optionRows = draft.options.map((o, i) => ({ question_id: qId, text: o.text, correct: !!o.correct, order: i }));
  const { error: oErr } = await admin.from("question_options").insert(optionRows);
  if (oErr) { await admin.from("questions").delete().eq("id", qId); return { ok: false, error: oErr.message }; }

  await snapshotQuestion(admin, qId, "initial", guard.userId);

  const { count: total } = await admin
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("module_slug", slug);
  await admin.from("modules").update({ questions_total: total ?? 0 }).eq("slug", slug);

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true, id: qId };
}

// ─── Edit question (manual) ────────────────────────────────────────────

export interface EditQuestionInput {
  questionId: string;
  text: string;
  explanation: string | null;
  options: { id?: string; text: string; correct: boolean }[];
}

export async function editQuestion(input: EditQuestionInput): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: q } = await sb.from("questions").select("module_slug").eq("id", input.questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!Array.isArray(input.options) || input.options.length !== 4) {
    return { ok: false, error: "Each question must have exactly 4 options" };
  }
  if (input.options.filter((o) => o.correct).length !== 1) {
    return { ok: false, error: "Mark exactly one option as correct" };
  }

  const admin = createAdminClient();
  // Preserve the pre-edit version before overwriting.
  await snapshotQuestion(admin, input.questionId, "edited", user.id);
  await admin
    .from("questions")
    .update({
      text: input.text,
      explanation: input.explanation,
      status: "edited",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", input.questionId);

  // Replace options.
  await admin.from("question_options").delete().eq("question_id", input.questionId);
  const optionRows = input.options.map((o, i) => ({
    question_id: input.questionId,
    text: o.text,
    correct: !!o.correct,
    order: i,
  }));
  await admin.from("question_options").insert(optionRows);

  // The text changed — refresh the cached Spanish translation in the background.
  void translateQuestionToSpanish(input.questionId).catch(() => {});

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}

// ─── Spanish translation of quiz content ───────────────────────────────

interface TranslatedQuestion {
  text_es: string;
  explanation_es: string;
  options: { order: number; text_es: string }[];
}

function parseTranslation(raw: string): TranslatedQuestion {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as TranslatedQuestion;
}

/**
 * Translate one question (stem + explanation + every option) into Spanish and
 * cache it in the *_es columns. Best-effort: callers fire-and-forget this so a
 * translation failure never blocks approving/editing. Skipped in DEMO_MODE.
 * Also backs a manual "Translate to Spanish" button — so it's exported.
 */
export async function translateQuestionToSpanish(
  questionId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: qRow } = await admin
    .from("questions")
    .select("text, explanation, module_slug")
    .eq("id", questionId)
    .single();
  if (!qRow) return { ok: false, error: "Question not found" };
  const { text, explanation, module_slug } = qRow as { text: string; explanation: string | null; module_slug: string };

  // Admin/owner only — stops an arbitrary user from spending AI budget or
  // overwriting cached translations on questions they don't own.
  const guard = await requireAdminOrModuleOwner(module_slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const { data: optRows } = await admin
    .from("question_options")
    .select("id, text, order")
    .eq("question_id", questionId)
    .order("order");
  const options = (optRows ?? []) as { id: string; text: string; order: number }[];

  let translated: TranslatedQuestion;
  try {
    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: QUESTION_TRANSLATE_SYSTEM },
        {
          role: "user",
          content: questionTranslateUserPrompt({
            text,
            explanation,
            options: options.map((o) => ({ order: o.order, text: o.text })),
          }),
        },
      ],
    });
    translated = parseTranslation(res.choices[0]?.message?.content ?? "");
  } catch (err) {
    return { ok: false, error: `AI error: ${(err as Error).message}` };
  }

  if (!translated.text_es) return { ok: false, error: "Empty translation" };

  // Cache the question's Spanish stem + explanation.
  await admin
    .from("questions")
    .update({
      text_es: translated.text_es,
      explanation_es: translated.explanation_es || null,
    })
    .eq("id", questionId);

  // Cache each option's Spanish text, matched back by its "order".
  const byOrder = new Map((translated.options ?? []).map((o) => [o.order, o.text_es]));
  await Promise.all(
    options.map((o) => {
      const es = byOrder.get(o.order);
      if (!es) return Promise.resolve();
      return admin.from("question_options").update({ text_es: es }).eq("id", o.id);
    }),
  );

  return { ok: true };
}

/**
 * Backfill Spanish for every approved/edited question in a module that has no
 * cached translation yet. Admin/owner-guarded; returns how many it filled.
 */
export async function backfillModuleSpanish(
  moduleSlug: string,
): Promise<{ ok: boolean; error?: string; translated?: number }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, translated: 0 };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("questions")
    .select("id")
    .eq("module_slug", moduleSlug)
    .in("status", ["approved", "edited"])
    .is("text_es", null);
  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);

  let done = 0;
  for (const id of ids) {
    const r = await translateQuestionToSpanish(id);
    if (r.ok) done++;
  }
  revalidatePath(`/teacher/modules/${moduleSlug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true, translated: done };
}

// ─── Spanish translation of admin-authored content (titles / descriptions) ──

/**
 * Translate a short title and/or description into Spanish in a single AI call.
 * Returns nulls on any failure / DEMO_MODE so callers simply leave the English
 * value (which is what employee reads fall back to). Exported so server actions
 * across modules/lessons/resources can reuse it.
 */
export async function translateContentFields(fields: {
  title?: string | null;
  description?: string | null;
}): Promise<{ title_es: string | null; description_es: string | null }> {
  const empty = { title_es: null, description_es: null };
  const title = fields.title?.trim() || undefined;
  const description = fields.description?.trim() || undefined;
  if (DEMO_MODE || (!title && !description)) return empty;

  try {
    const openai = openaiClient();
    const res = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONTENT_TRANSLATE_SYSTEM },
        { role: "user", content: contentTranslateUserPrompt({ title, description }) },
      ],
    });
    let cleaned = (res.choices[0]?.message?.content ?? "").trim();
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a !== -1 && b !== -1 && b > a) cleaned = cleaned.slice(a, b + 1);
    const parsed = JSON.parse(cleaned) as { title_es?: string; description_es?: string };
    return {
      title_es: title ? parsed.title_es?.trim() || null : null,
      description_es: description ? parsed.description_es?.trim() || null : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Backfill Spanish for every employee-visible title/description that has none
 * yet — across modules, lessons, lesson contents and resources. Admin-only,
 * re-runnable (only touches rows where the *_es column is still null). Returns
 * how many rows it filled. Best-effort per row; a failure leaves English.
 */
export async function backfillContentSpanish(): Promise<{
  ok: boolean;
  error?: string;
  translated?: number;
}> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((prof as { role?: Role } | null)?.role !== "admin") return { ok: false, error: "Admin role required" };
  if (DEMO_MODE) return { ok: true, translated: 0 };

  const admin = createAdminClient();
  let done = 0;

  // Modules — title + description.
  const { data: mods } = await admin
    .from("modules")
    .select("slug, title, description")
    .is("title_es", null);
  for (const m of ((mods ?? []) as { slug: string; title: string; description: string | null }[])) {
    const tr = await translateContentFields({ title: m.title, description: m.description });
    if (tr.title_es || tr.description_es) {
      await admin.from("modules").update({ title_es: tr.title_es, description_es: tr.description_es }).eq("slug", m.slug);
      done++;
    }
  }

  // Lessons — title + description.
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, description")
    .is("title_es", null);
  for (const l of ((lessons ?? []) as { id: string; title: string; description: string | null }[])) {
    const tr = await translateContentFields({ title: l.title, description: l.description });
    if (tr.title_es || tr.description_es) {
      await admin.from("lessons").update({ title_es: tr.title_es, description_es: tr.description_es }).eq("id", l.id);
      done++;
    }
  }

  // Lesson contents — title only.
  const { data: contents } = await admin
    .from("lesson_contents")
    .select("id, title")
    .is("title_es", null);
  for (const c of ((contents ?? []) as { id: string; title: string }[])) {
    const tr = await translateContentFields({ title: c.title });
    if (tr.title_es) {
      await admin.from("lesson_contents").update({ title_es: tr.title_es }).eq("id", c.id);
      done++;
    }
  }

  // Resources — title + description.
  const { data: resources } = await admin
    .from("resources")
    .select("id, title, description")
    .is("title_es", null);
  for (const r of ((resources ?? []) as { id: string; title: string; description: string | null }[])) {
    const tr = await translateContentFields({ title: r.title, description: r.description });
    if (tr.title_es || tr.description_es) {
      await admin.from("resources").update({ title_es: tr.title_es, description_es: tr.description_es }).eq("id", r.id);
      done++;
    }
  }

  revalidatePath("/manager/dashboard");
  revalidatePath("/manager/modules");
  revalidatePath("/manager/resources");
  return { ok: true, translated: done };
}

// ─── Who answered this question (admin/lead drill-down) ────────────────

export interface QuestionResponder {
  name: string;
  correct: boolean;
  attemptedAt: string;
}

/** Everyone who has answered a given question, with right/wrong + when. */
export async function getQuestionResponders(
  questionId: string,
): Promise<{ ok: true; responders: QuestionResponder[] } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: answers } = await admin
    .from("attempt_answers")
    .select("attempt_id, correct, answered_at")
    .eq("question_id", questionId);
  const ansRows = (answers ?? []) as { attempt_id: string; correct: boolean; answered_at: string }[];
  if (ansRows.length === 0) return { ok: true, responders: [] };

  const { data: attempts } = await admin
    .from("attempts")
    .select("id, manager_id")
    .in("id", ansRows.map((a) => a.attempt_id));
  const managerByAttempt = new Map(
    ((attempts ?? []) as { id: string; manager_id: string }[]).map((a) => [a.id, a.manager_id]),
  );

  const managerIds = Array.from(new Set([...managerByAttempt.values()]));
  const { data: people } = await admin.from("profiles").select("id, name").in("id", managerIds);
  const nameById = new Map(((people ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const responders = ansRows
    .map((a) => {
      const managerId = managerByAttempt.get(a.attempt_id);
      return {
        name: (managerId && nameById.get(managerId)) || "Unknown",
        correct: a.correct,
        attemptedAt: a.answered_at,
      };
    })
    .sort((x, y) => +new Date(y.attemptedAt) - +new Date(x.attemptedAt));

  return { ok: true, responders };
}

// ─── Version history: list + restore ───────────────────────────────────

export async function getQuestionVersions(
  questionId: string,
): Promise<{ ok: true; versions: QuestionVersion[] } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const versions = await listQuestionVersions(questionId);
  return { ok: true, versions };
}

export async function restoreQuestionVersion(
  questionId: string,
  versionNumber: number,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: q } = await sb.from("questions").select("module_slug").eq("id", questionId).single();
  if (!q) return { ok: false, error: "Question not found" };
  const slug = (q as { module_slug: string }).module_slug;

  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: verRow } = await admin
    .from("question_versions")
    .select("text, explanation, options")
    .eq("question_id", questionId)
    .eq("version_number", versionNumber)
    .maybeSingle();
  if (!verRow) return { ok: false, error: "Version not found" };
  const ver = verRow as {
    text: string;
    explanation: string | null;
    options: { text: string; correct: boolean; order: number }[] | null;
  };

  // Snapshot the current state before reverting, so a restore is itself undoable.
  await snapshotQuestion(admin, questionId, "restored", user.id);

  await admin
    .from("questions")
    .update({
      text: ver.text,
      explanation: ver.explanation,
      status: "edited",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", questionId);

  await admin.from("question_options").delete().eq("question_id", questionId);
  const optionRows = (ver.options ?? []).map((o, i) => ({
    question_id: questionId,
    text: o.text,
    correct: !!o.correct,
    order: typeof o.order === "number" ? o.order : i,
  }));
  if (optionRows.length > 0) {
    await admin.from("question_options").insert(optionRows);
  }

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
}
