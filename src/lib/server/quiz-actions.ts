"use server";

// Quiz engine — server actions that wrap the SECURITY DEFINER RPCs defined in
// migration 0001 (start_quiz_attempt + submit_quiz_attempt).
//
// The RPCs enforce: manager role, module published, server-side grading
// (the `correct` field is never sent to the client), retake auto-scheduling
// on first failure, and 'at-risk' flagging on second failure. We only:
//   1. decide which question pool to serve (first-attempt vs retake) by
//      inspecting the caller's prior attempts for this module
//   2. shape the payload for the client

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/emails/send";
import { pushInAppNotification } from "@/lib/notifications/push";
import { decideQuizPool } from "@/lib/quiz-pool";
import type { QuestionPool } from "@/types";

export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; order: number }[];
}

export type StartQuizResult =
  | {
      ok: true;
      attemptId: string;
      questions: QuizQuestion[];
      timeLimitMinutes: number | null;
      pool: QuestionPool;
    }
  | { ok: false; error: string };

export async function startQuiz(moduleSlug: string): Promise<StartQuizResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Already-passed guard — block opening the quiz a second time.
  const { data: priorAttempts, error: attemptsError } = await sb
    .from("attempts")
    .select("pool, status, started_at")
    .eq("manager_id", user.id)
    .eq("module_slug", moduleSlug)
    .order("started_at", { ascending: false })
    .limit(10);

  if (attemptsError) return { ok: false, error: attemptsError.message };

  const rows = (priorAttempts ?? []) as { pool: QuestionPool; status: string; started_at: string }[];

  const decision = decideQuizPool(rows);
  if (decision.kind === "passed") {
    return { ok: false, error: "You have already passed this module." };
  }
  if (decision.kind === "locked") {
    return { ok: false, error: "You've used all 3 attempts for this module. Your Department Lead will reach out to help." };
  }
  const pool: QuestionPool = decision.pool;

  const { data, error } = await sb.rpc("start_quiz_attempt", {
    p_module_slug: moduleSlug,
    p_pool: pool,
  });

  if (error) return { ok: false, error: error.message };

  const payload = data as {
    attempt_id: string;
    time_limit_minutes: number | null;
    questions: QuizQuestion[];
  };

  if (!payload?.questions?.length) {
    return {
      ok: false,
      error: "No approved questions are available for this module yet.",
    };
  }

  return {
    ok: true,
    attemptId: payload.attempt_id,
    questions: payload.questions,
    timeLimitMinutes: payload.time_limit_minutes,
    pool,
  };
}

export type SubmitQuizResult =
  | {
      ok: true;
      passed: boolean;
      scorePct: number;
      correctCount: number;
      totalCount: number;
      locked: boolean;
      attemptsRemaining: number;
    }
  | { ok: false; error: string };

export interface QuizAnswerInput {
  question_id: string;
  selected_option_id: string | null;
}

export async function submitQuiz(
  attemptId: string,
  answers: QuizAnswerInput[],
): Promise<SubmitQuizResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await sb.rpc("submit_quiz_attempt", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });

  if (error) return { ok: false, error: error.message };

  const payload = data as {
    attempt_id: string;
    score_pct: number;
    correct_count: number;
    total_count: number;
    passed: boolean;
    locked: boolean;
    attempts_remaining: number;
  };

  // Refresh anywhere the manager sees their progress + the admin/teacher dashboards.
  revalidatePath("/manager/dashboard");
  revalidatePath("/manager/progress");
  revalidatePath("/manager/modules");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/results");
  revalidatePath("/admin/at-risk");

  // Fire-and-forget the pass/fail result email. Errors are swallowed so a
  // mail delivery failure never blocks the quiz response.
  void sendQuizResultEmail(user.id, payload).catch(() => {});

  // On lockout (3 strikes), notify the module's leads + admins so they can step in.
  if (payload.locked) {
    void notifyLockout(user.id, payload.attempt_id).catch(() => {});
  }

  return {
    ok: true,
    passed: payload.passed,
    scorePct: Number(payload.score_pct),
    correctCount: payload.correct_count,
    totalCount: payload.total_count,
    locked: payload.locked,
    attemptsRemaining: payload.attempts_remaining,
  };
}

// Notify the module's owning Department Lead(s) + admins that an employee is out
// of attempts and needs manual help.
async function notifyLockout(userId: string, attemptId: string) {
  const admin = createAdminClient();
  const { data: attempt } = await admin.from("attempts").select("module_slug").eq("id", attemptId).single();
  const slug = (attempt as { module_slug?: string } | null)?.module_slug;
  if (!slug) return;
  const [{ data: prof }, { data: mod }, { data: owners }, { data: admins }] = await Promise.all([
    admin.from("profiles").select("name").eq("id", userId).single(),
    admin.from("modules").select("title").eq("slug", slug).single(),
    admin.from("module_owners").select("teacher_id").eq("module_slug", slug),
    admin.from("profiles").select("id").eq("role", "admin"),
  ]);
  const name = (prof as { name?: string } | null)?.name ?? "An employee";
  const title = (mod as { title?: string } | null)?.title ?? slug;
  const recipientIds = new Set<string>([
    ...((owners ?? []) as { teacher_id: string }[]).map((o) => o.teacher_id),
    ...((admins ?? []) as { id: string }[]).map((a) => a.id),
  ]);
  await Promise.all(
    [...recipientIds].map((rid) =>
      pushInAppNotification({
        recipientId: rid,
        kind: "alert",
        subject: `Out of attempts — ${title}`,
        preview: `${name} has used all 3 attempts on ${title} without passing. Please reach out to help.`,
        href: "/admin/at-risk",
      }),
    ),
  );
}

async function sendQuizResultEmail(
  userId: string,
  result: { attempt_id: string; score_pct: number; passed: boolean },
) {
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("module_slug")
    .eq("id", result.attempt_id)
    .single();
  if (!attempt) return;
  const moduleSlug = (attempt as { module_slug: string }).module_slug;

  const { data: profile } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .single();
  if (!profile) return;
  const { name, email } = profile as { name: string; email: string };

  const { data: mod } = await admin
    .from("modules")
    .select("title, number")
    .eq("slug", moduleSlug)
    .single();
  if (!mod) return;
  const { title, number } = mod as { title: string; number: number };

  const score = Math.round(Number(result.score_pct)).toString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const progressLink = `${appUrl}/manager/progress`;
  const retakeLink = `${appUrl}/manager/modules/${moduleSlug}/quiz`;

  if (result.passed) {
    await sendEmail({
      to: email,
      templateKey: "quiz_passed",
      recipientUserId: userId,
      href: "/manager/progress",
      variables: {
        name,
        module_title: title,
        score,
        next_module_date: `Module ${number + 1}`,
        progress_link: progressLink,
      },
    });
  } else {
    await sendEmail({
      to: email,
      templateKey: "quiz_failed",
      recipientUserId: userId,
      href: `/manager/modules/${moduleSlug}`,
      variables: {
        name,
        module_title: title,
        score,
        retake_link: retakeLink,
      },
    });
  }
}
