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
import { claudeClient, DEFAULT_MODEL } from "@/lib/ai/claude";
import {
  QUESTION_GEN_SYSTEM,
  questionGenUserPrompt,
  questionRegenSystem,
  questionRegenUserPrompt,
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
  // Strip code fences if Claude included them despite the instructions.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Sometimes there's a preamble. Slice from first `[` to last `]`.
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Expected array");
  return parsed as DraftQuestion[];
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

async function callClaudeForBatch(
  content: string,
  pool: QuestionPool,
  count: number,
): Promise<DraftQuestion[]> {
  const claude = claudeClient();
  const msg = await claude.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8000,
    system: QUESTION_GEN_SYSTEM,
    messages: [{ role: "user", content: questionGenUserPrompt(content, pool, count) }],
  });

  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  try {
    return extractJsonArray(text);
  } catch {
    // Retry once with a stricter follow-up.
    const retry = await claude.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      system: QUESTION_GEN_SYSTEM,
      messages: [
        { role: "user", content: questionGenUserPrompt(content, pool, count) },
        { role: "assistant", content: text },
        { role: "user", content: "That output was not valid JSON. Please respond with ONLY the raw JSON array, no preamble, no markdown fences." },
      ],
    });
    const retryText = retry.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return extractJsonArray(retryText);
  }
}

function buildSourceContent(lessons: { title: string; description: string; contents: { type: string; title: string; metadata: unknown }[] }[]): string {
  const chunks: string[] = [];
  for (const l of lessons) {
    chunks.push(`## ${l.title}\n${l.description}`);
    for (const c of l.contents) {
      chunks.push(`### ${c.type.toUpperCase()}: ${c.title}`);
      const meta = c.metadata as { documentPages?: string[]; slides?: { title: string; bullets: string[] }[] } | null;
      if (meta?.documentPages) {
        chunks.push(meta.documentPages.join("\n\n"));
      }
      if (meta?.slides) {
        for (const s of meta.slides) {
          chunks.push(`Slide: ${s.title}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`);
        }
      }
    }
  }
  // Truncate so we don't exceed Claude's input window cost-effectively.
  const joined = chunks.join("\n\n");
  return joined.length > 50_000 ? joined.slice(0, 50_000) : joined;
}

export async function generateQuestions(moduleSlug: string): Promise<
  | { ok: true; created: number }
  | { ok: false; error: string }
> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();
  const { data: lessonsData } = await admin
    .from("lessons")
    .select("title, description, lesson_contents(type, title, metadata)")
    .eq("module_slug", moduleSlug)
    .order("order");

  const lessons = (lessonsData ?? []) as {
    title: string;
    description: string;
    lesson_contents: { type: string; title: string; metadata: unknown }[];
  }[];

  if (lessons.length === 0) {
    return { ok: false, error: "This module has no lessons yet — add content first." };
  }

  const sourceContent = buildSourceContent(
    lessons.map((l) => ({
      title: l.title,
      description: l.description,
      contents: l.lesson_contents ?? [],
    })),
  );

  if (sourceContent.trim().length < 200) {
    return {
      ok: false,
      error: "Not enough source content. Add lesson manuals, slides, or documents before generating questions.",
    };
  }

  if (DEMO_MODE) {
    // Demo: skip the Claude call and stub a few pending questions so the UI
    // can be exercised without burning API credits.
    return { ok: true, created: 0 };
  }

  let firstAttempt: DraftQuestion[] = [];
  let retake: DraftQuestion[] = [];
  try {
    [firstAttempt, retake] = await Promise.all([
      callClaudeForBatch(sourceContent, "first-attempt", FIRST_ATTEMPT_COUNT),
      callClaudeForBatch(sourceContent, "retake", RETAKE_COUNT),
    ]);
  } catch (err) {
    return { ok: false, error: `Claude error: ${(err as Error).message}` };
  }

  // Insert questions + options under a single transaction-flavoured pass.
  const allDrafts = [
    ...firstAttempt.map((q) => ({ ...q, pool: "first-attempt" as QuestionPool })),
    ...retake.map((q) => ({ ...q, pool: "retake" as QuestionPool })),
  ];

  let created = 0;

  for (const draft of allDrafts) {
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
      })
      .select("id")
      .single();

    if (qErr || !insertedQ) continue;
    const qId = (insertedQ as { id: string }).id;

    const optionRows = draft.options.map((o, i) => ({
      question_id: qId,
      text: o.text,
      correct: !!o.correct,
      order: i,
    }));

    const { error: oErr } = await admin.from("question_options").insert(optionRows);
    if (oErr) {
      // Roll back this question if its options failed to insert.
      await admin.from("questions").delete().eq("id", qId);
      continue;
    }

    // Baseline version snapshot.
    await snapshotQuestion(admin, qId, "initial", guard.userId);

    created++;
  }

  // Refresh denormalised counts on the module row.
  const { count: totalCount } = await admin
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("module_slug", moduleSlug);
  await admin
    .from("modules")
    .update({ questions_total: totalCount ?? 0 })
    .eq("slug", moduleSlug);

  revalidatePath(`/teacher/modules/${moduleSlug}/questions`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/admin/questions`);

  return { ok: true, created };
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
    const claude = claudeClient();
    const msg = await claude.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: questionRegenSystem(),
      messages: [{ role: "user", content: questionRegenUserPrompt(originalText, null) }],
    });
    const text = msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    draft = extractJsonObject(text);
  } catch (err) {
    return { ok: false, error: `Claude error: ${(err as Error).message}` };
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

  revalidatePath(`/teacher/modules/${slug}/questions`);
  revalidatePath(`/admin/questions`);
  return { ok: true };
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
