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
  | { kind: "locked" } // used all 3 attempts (3 strikes) without passing
  | { kind: "serve"; pool: QuestionPool };

/** Max failed attempts before the module locks ("3 strikes"). */
export const MAX_STRIKES = 3;

export function decideQuizPool(
  priorAttempts: { pool: QuestionPool; status: string }[],
): PoolDecision {
  if (priorAttempts.some((a) => a.status === "passed")) {
    return { kind: "passed" };
  }
  const failed = priorAttempts.filter((a) => a.status === "failed").length;
  if (failed >= MAX_STRIKES) {
    return { kind: "locked" };
  }
  // Any prior failure → serve the (reworded) retake pool; otherwise first attempt.
  return { kind: "serve", pool: failed >= 1 ? "retake" : "first-attempt" };
}
