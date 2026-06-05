// Questions — DB queries matching src/data/questions.ts shape.

import { dbClient } from "@/lib/supabase/db-client";
import { createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Question, QuestionPool, QuestionStatus } from "@/types";

interface QuestionRow {
  id: string;
  module_slug: string;
  pool: QuestionPool;
  status: QuestionStatus;
  text: string;
  explanation: string | null;
  generated_by_ai: boolean;
  approved_at: string | null;
  approved_by: string | null;
  hits: number;
  miss_rate: number;
  created_at: string;
}

interface OptionRow {
  id: string;
  question_id: string;
  text: string;
  correct: boolean;
  order: number;
}

function hydrate(qRows: QuestionRow[], optsByQ: Map<string, OptionRow[]>, approverNames?: Map<string, string>): Question[] {
  return qRows.map((r) => ({
    id: r.id,
    moduleSlug: r.module_slug,
    pool: r.pool,
    status: r.status,
    text: r.text,
    options: (optsByQ.get(r.id) ?? []).map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
    explanation: r.explanation ?? undefined,
    generatedByAI: r.generated_by_ai,
    createdAt: r.created_at,
    approvedAt: r.approved_at ?? undefined,
    approvedBy: r.approved_by ?? undefined,
    approvedByName: r.approved_by ? approverNames?.get(r.approved_by) : undefined,
    hits: r.hits,
    missRate: r.miss_rate,
  }));
}

async function fetchQuestions(sb: SupabaseClient, slug: string, pool?: QuestionPool): Promise<Question[]> {
  let q = sb.from("questions").select("*").eq("module_slug", slug);
  if (pool) q = q.eq("pool", pool);
  const { data: questions } = await q;
  const qRows = (questions ?? []) as QuestionRow[];

  if (qRows.length === 0) return [];

  const { data: options } = await sb
    .from("question_options")
    .select("*")
    .in("question_id", qRows.map((r) => r.id))
    .order("order");

  const optsByQ = new Map<string, OptionRow[]>();
  for (const o of (options ?? []) as OptionRow[]) {
    const list = optsByQ.get(o.question_id) ?? [];
    list.push(o);
    optsByQ.set(o.question_id, list);
  }

  const approverNames = await namesByIds(sb, qRows.map((r) => r.approved_by));
  return hydrate(qRows, optsByQ, approverNames);
}

export async function listQuestionsForModule(slug: string, pool?: QuestionPool): Promise<Question[]> {
  return fetchQuestions(await dbClient(), slug, pool);
}

/**
 * Questions for a module via the service-role client (bypasses RLS).
 *
 * Managers have no RLS read access to `questions` (so quiz answers can't leak
 * mid-quiz). But an employee reviewing their OWN already-submitted attempt
 * must see the question text + options. The caller MUST authorise ownership of
 * the attempt before using this. For failed attempts, sanitise away the
 * correct flag + explanation before sending to the client (see attempt page).
 */
export async function listQuestionsForModuleAsAdmin(slug: string, pool?: QuestionPool): Promise<Question[]> {
  return fetchQuestions(createAdminClient(), slug, pool);
}

/** Resolve a set of profile ids to their display names (one query). */
async function namesByIds(sb: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Map();
  const { data } = await sb.from("profiles").select("id, name").in("id", unique);
  const m = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; name: string }[]) m.set(r.id, r.name);
  return m;
}

// ─── Version history ───────────────────────────────────────────────────

export interface QuestionVersion {
  id: string;
  versionNumber: number;
  text: string;
  explanation: string | null;
  options: { text: string; correct: boolean; order: number }[];
  status: QuestionStatus;
  changeReason: string;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: string;
}

interface QuestionVersionRow {
  id: string;
  question_id: string;
  version_number: number;
  text: string;
  explanation: string | null;
  options: { text: string; correct: boolean; order: number }[] | null;
  status: QuestionStatus;
  change_reason: string;
  changed_by: string | null;
  created_at: string;
}

export async function listQuestionVersions(questionId: string): Promise<QuestionVersion[]> {
  const sb = await dbClient();
  const { data } = await sb
    .from("question_versions")
    .select("*")
    .eq("question_id", questionId)
    .order("version_number", { ascending: false });

  const rows = (data ?? []) as QuestionVersionRow[];
  const names = await namesByIds(sb, rows.map((r) => r.changed_by));

  return rows.map((r) => ({
    id: r.id,
    versionNumber: r.version_number,
    text: r.text,
    explanation: r.explanation,
    options: r.options ?? [],
    status: r.status,
    changeReason: r.change_reason,
    changedBy: r.changed_by,
    changedByName: r.changed_by ? names.get(r.changed_by) ?? null : null,
    createdAt: r.created_at,
  }));
}

export async function listQuestions(): Promise<Question[]> {
  const sb = await dbClient();
  const { data: questions } = await sb.from("questions").select("*");
  const qRows = (questions ?? []) as QuestionRow[];

  if (qRows.length === 0) return [];

  const { data: options } = await sb
    .from("question_options")
    .select("*")
    .in("question_id", qRows.map((r) => r.id))
    .order("order");

  const optsByQ = new Map<string, OptionRow[]>();
  for (const o of (options ?? []) as OptionRow[]) {
    const list = optsByQ.get(o.question_id) ?? [];
    list.push(o);
    optsByQ.set(o.question_id, list);
  }

  return hydrate(qRows, optsByQ);
}

// Lightweight variant for list/library views that never render answer options:
// fetches questions only (skips the question_options query + payload).
export async function listQuestionsLite(): Promise<Question[]> {
  const sb = await dbClient();
  const { data: questions } = await sb.from("questions").select("*");
  const qRows = (questions ?? []) as QuestionRow[];
  if (qRows.length === 0) return [];
  return hydrate(qRows, new Map<string, OptionRow[]>());
}
