// Pure decision: which question pool to serve a manager for a module, based on
// their prior attempts. Extracted from quiz-actions.ts so it's unit-testable
// without a DB or a request context.
//
// Rules (per scope §4.1.3):
//   - Already passed → blocked (can't reopen).
//   - Failed the first-attempt pool (and not later passed) → serve the easier
//     retake pool.
//   - Otherwise → serve the first-attempt pool.

import type { QuestionPool } from "@/types";

export type PoolDecision =
  | { kind: "passed" }
  | { kind: "serve"; pool: QuestionPool };

export function decideQuizPool(
  priorAttempts: { pool: QuestionPool; status: string }[],
): PoolDecision {
  if (priorAttempts.some((a) => a.status === "passed")) {
    return { kind: "passed" };
  }
  const failedFirst = priorAttempts.some(
    (a) => a.pool === "first-attempt" && a.status === "failed",
  );
  return { kind: "serve", pool: failedFirst ? "retake" : "first-attempt" };
}
