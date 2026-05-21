import { describe, it, expect } from "vitest";
import { decideQuizPool } from "@/lib/quiz-pool";

describe("decideQuizPool", () => {
  it("blocks when the module is already passed", () => {
    expect(decideQuizPool([{ pool: "first-attempt", status: "passed" }])).toEqual({
      kind: "passed",
    });
  });

  it("serves the first-attempt pool when there are no prior attempts", () => {
    expect(decideQuizPool([])).toEqual({ kind: "serve", pool: "first-attempt" });
  });

  it("serves the retake pool after a failed first attempt", () => {
    expect(decideQuizPool([{ pool: "first-attempt", status: "failed" }])).toEqual({
      kind: "serve",
      pool: "retake",
    });
  });

  it("treats 'passed' as final even when an earlier attempt failed", () => {
    expect(
      decideQuizPool([
        { pool: "first-attempt", status: "failed" },
        { pool: "retake", status: "passed" },
      ]),
    ).toEqual({ kind: "passed" });
  });
});
