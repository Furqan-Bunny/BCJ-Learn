import { describe, it, expect } from "vitest";
import { computeQuizState } from "@/lib/quiz-state";
import type { Attempt } from "@/types";

function mkAttempt(p: Partial<Attempt> = {}): Attempt {
  return {
    id: "a1",
    managerId: "m1",
    moduleSlug: "mod",
    pool: "first-attempt",
    status: "failed",
    startedAt: "2026-06-02T10:00:00.000Z",
    scorePct: 0,
    correctCount: 0,
    totalCount: 25,
    answers: [],
    ...p,
  } as Attempt;
}

const now = new Date("2026-06-15T12:00:00.000Z");

describe("computeQuizState", () => {
  it("passed → returns refresher due ~1 year out", () => {
    const state = computeQuizState({
      currentAttempts: [mkAttempt({ status: "passed", submittedAt: "2026-06-10T10:00:00.000Z", scorePct: 92 })],
      scheduledDate: "2026-06-01",
      isCheckedIn: true,
      now,
    });
    expect(state.kind).toBe("passed");
    if (state.kind === "passed") {
      expect(new Date(state.refresherDueDate).getUTCFullYear()).toBe(2027);
    }
  });

  it("one failed first attempt → needs-retake", () => {
    const state = computeQuizState({
      currentAttempts: [mkAttempt({ pool: "first-attempt", status: "failed" })],
      scheduledDate: "2026-06-01",
      isCheckedIn: true,
      now,
    });
    expect(state.kind).toBe("needs-retake");
  });

  it("failed first + retake (2 strikes) → still needs-retake, 1 left", () => {
    const state = computeQuizState({
      currentAttempts: [
        mkAttempt({ id: "a1", pool: "first-attempt", status: "failed", startedAt: "2026-06-02T10:00:00.000Z" }),
        mkAttempt({ id: "a2", pool: "retake", status: "failed", startedAt: "2026-06-03T10:00:00.000Z" }),
      ],
      scheduledDate: "2026-06-01",
      isCheckedIn: true,
      now,
    });
    expect(state.kind).toBe("needs-retake");
    if (state.kind === "needs-retake") expect(state.attemptsRemaining).toBe(1);
  });

  it("three failed attempts (3 strikes) → locked", () => {
    const state = computeQuizState({
      currentAttempts: [
        mkAttempt({ id: "a1", pool: "first-attempt", status: "failed", startedAt: "2026-06-02T10:00:00.000Z" }),
        mkAttempt({ id: "a2", pool: "retake", status: "failed", startedAt: "2026-06-03T10:00:00.000Z" }),
        mkAttempt({ id: "a3", pool: "retake", status: "failed", startedAt: "2026-06-04T10:00:00.000Z" }),
      ],
      scheduledDate: "2026-06-01",
      isCheckedIn: true,
      now,
    });
    expect(state.kind).toBe("locked");
  });

  it("no attempts, checked in → ready", () => {
    const state = computeQuizState({
      currentAttempts: [],
      scheduledDate: "2026-06-14",
      isCheckedIn: true,
      now,
    });
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") expect(state.checkedIn).toBe(true);
  });

  it("no attempts, not checked in, seminar upcoming → awaiting-seminar", () => {
    const state = computeQuizState({
      currentAttempts: [],
      scheduledDate: "2026-07-01",
      isCheckedIn: false,
      now,
    });
    expect(state.kind).toBe("awaiting-seminar");
  });

  it("no attempts, not checked in, seminar already passed → missed-session", () => {
    const state = computeQuizState({
      currentAttempts: [],
      scheduledDate: "2026-06-01",
      isCheckedIn: false,
      now,
    });
    expect(state.kind).toBe("missed-session");
  });
});
