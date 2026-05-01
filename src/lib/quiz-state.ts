// Computes the manager-facing quiz state for a given (manager, module) pair.
// Used by:
//   - Manager dashboard hero
//   - Manager modules list cards
//   - Manager module detail page
//
// Inputs:
//   - The manager's attempt history (filtered to current delivery)
//   - The module's scheduled date
//   - Whether the manager has checked in for the current delivery
//
// Outputs one of six states. The UI renders a different CTA per state.
//
// Scope alignment (BCJ_Training_Tool_Scoping.md §4.1.2 / §4.1.3 / §5.1):
//   - On-site quiz happens AFTER the live in-person seminar.
//   - Failed first attempt → automatic retake assignment with easier pool.
//   - Pass once → no need to retake. (BCJ recommends annual refresher.)

import type { Attempt } from "@/types";

export type QuizState =
  | { kind: "passed"; passedAttempt: Attempt; refresherDueDate: string }
  | { kind: "needs-retake"; failedAttempt: Attempt }
  | { kind: "failed-twice"; firstAttempt: Attempt; retakeAttempt: Attempt }
  | { kind: "ready"; checkedIn: boolean }
  | { kind: "awaiting-seminar"; seminarDate: string }
  | { kind: "missed-session"; seminarDate: string };

export interface QuizStateInput {
  /** Attempts in the CURRENT delivery (already filtered by date if applicable). */
  currentAttempts: Attempt[];
  /** Module's scheduled training day (ISO). */
  scheduledDate: string;
  /** Whether the manager has checked in for the current delivery. */
  isCheckedIn: boolean;
  /** "Today" override (for testing); defaults to new Date(). */
  now?: Date;
}

export function computeQuizState({
  currentAttempts,
  scheduledDate,
  isCheckedIn,
  now = new Date(),
}: QuizStateInput): QuizState {
  // Sort attempts by start time, oldest first
  const sorted = [...currentAttempts].sort(
    (a, b) => +new Date(a.startedAt) - +new Date(b.startedAt),
  );

  const passedAttempt = sorted.find((a) => a.status === "passed");
  if (passedAttempt) {
    // BCJ recommends an annual refresher — quiz button hidden until then.
    const passedAt = new Date(passedAttempt.submittedAt ?? passedAttempt.startedAt);
    const refresherDue = new Date(passedAt);
    refresherDue.setFullYear(refresherDue.getFullYear() + 1);
    return {
      kind: "passed",
      passedAttempt,
      refresherDueDate: refresherDue.toISOString(),
    };
  }

  // No passed attempt → look at failures
  const failedAttempts = sorted.filter((a) => a.status === "failed");

  if (failedAttempts.length === 0) {
    // No attempts at all — quiz availability depends on seminar timing
    const trainingDay = new Date(scheduledDate);
    const trainingDayPassed = trainingDay.getTime() < now.getTime();

    if (isCheckedIn) {
      // Checked in → quiz unlocks (the seminar is happening or just ended)
      return { kind: "ready", checkedIn: true };
    }

    if (trainingDayPassed) {
      // Training day passed and they never checked in
      return { kind: "missed-session", seminarDate: scheduledDate };
    }

    // Training day still upcoming
    return { kind: "awaiting-seminar", seminarDate: scheduledDate };
  }

  // Has failures
  const firstAttempt = failedAttempts[0];
  const retakeAttempt = failedAttempts.find((a, i) => i > 0 && a.pool === "retake");

  if (retakeAttempt) {
    // Failed first AND failed retake → escalate to admin / trainer
    return { kind: "failed-twice", firstAttempt, retakeAttempt };
  }

  // Failed first attempt only — retake auto-scheduled (per scope §4.1.3)
  return { kind: "needs-retake", failedAttempt: firstAttempt };
}
