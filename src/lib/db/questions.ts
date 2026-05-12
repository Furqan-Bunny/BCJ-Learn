// Questions — DB queries matching src/data/questions.ts shape.

import { dbClient } from "@/lib/supabase/db-client";
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

export async function listQuestionsForModule(slug: string, pool?: QuestionPool): Promise<Question[]> {
  const sb = await dbClient();
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
    hits: r.hits,
    missRate: r.miss_rate,
  }));
}
