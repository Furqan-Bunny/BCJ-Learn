// Attempts — DB queries matching src/data/attempts.ts shape.

import { dbClient } from "@/lib/supabase/db-client";
import type { Attempt, AttemptStatus, QuestionPool } from "@/types";

interface AttemptRow {
  id: string;
  manager_id: string;
  module_slug: string;
  pool: QuestionPool;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  score_pct: number;
  correct_count: number;
  total_count: number;
  duration_sec: number | null;
}

function rowToAttempt(r: AttemptRow): Attempt {
  return {
    id: r.id,
    managerId: r.manager_id,
    moduleSlug: r.module_slug,
    pool: r.pool,
    status: r.status,
    startedAt: r.started_at,
    submittedAt: r.submitted_at ?? undefined,
    scorePct: r.score_pct,
    correctCount: r.correct_count,
    totalCount: r.total_count,
    durationSec: r.duration_sec ?? undefined,
    answers: [], // loaded separately if needed
  };
}

export async function listAttempts(): Promise<Attempt[]> {
  const sb = await dbClient();
  const { data } = await sb.from("attempts").select("*").order("started_at", { ascending: false });
  return (data ?? []).map((r) => rowToAttempt(r as AttemptRow));
}

export async function listAttemptsForManager(managerId: string): Promise<Attempt[]> {
  const sb = await dbClient();
  const { data } = await sb.from("attempts").select("*").eq("manager_id", managerId).order("started_at", { ascending: false });
  return (data ?? []).map((r) => rowToAttempt(r as AttemptRow));
}

export async function listAttemptsForModule(slug: string): Promise<Attempt[]> {
  const sb = await dbClient();
  const { data } = await sb.from("attempts").select("*").eq("module_slug", slug).order("started_at", { ascending: false });
  return (data ?? []).map((r) => rowToAttempt(r as AttemptRow));
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  const sb = await dbClient();
  const [{ data: attemptRow }, { data: answerRows }] = await Promise.all([
    sb.from("attempts").select("*").eq("id", id).maybeSingle(),
    sb
      .from("attempt_answers")
      .select("question_id, selected_option_id, correct")
      .eq("attempt_id", id),
  ]);
  if (!attemptRow) return null;
  const attempt = rowToAttempt(attemptRow as AttemptRow);
  attempt.answers = ((answerRows ?? []) as { question_id: string; selected_option_id: string | null; correct: boolean }[]).map(
    (a) => ({
      questionId: a.question_id,
      selectedOptionId: a.selected_option_id ?? "",
      correct: a.correct,
    }),
  );
  return attempt;
}
