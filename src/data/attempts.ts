import { faker } from "@faker-js/faker";
import type { Attempt, AttemptStatus, QuestionPool } from "@/types";
import { managers } from "./users";
import { modules } from "./modules";
import { questionsForModule } from "./questions";

faker.seed(20260503);

export const attempts: Attempt[] = [];

let counter = 1;
for (const m of managers) {
  // Each manager has progressed through some modules
  for (let mi = 0; mi < m.modulesCompleted + (m.status === "at-risk" ? 1 : 0); mi++) {
    const mod = modules[mi];
    if (!mod) continue;

    const failedFirst = faker.datatype.boolean(m.status === "at-risk" ? 0.6 : 0.18);
    const pool: QuestionPool = "first-attempt";
    const approvedQuestions = questionsForModule(mod.slug, pool).filter((q) => q.status === "approved");
    if (approvedQuestions.length === 0) continue;

    const total = mod.questionCount;
    // Demo dates: spread attempts over the last 90 days regardless of module scheduledDate
    // (some modules are scheduled in the future relative to "now").
    const startedAt = faker.date.recent({ days: 90 }).toISOString();
    const durationSec = faker.number.int({ min: 600, max: 1700 });

    const correctCount = failedFirst
      ? Math.floor(total * faker.number.float({ min: 0.55, max: 0.78 }))
      : Math.floor(total * faker.number.float({ min: 0.86, max: 0.98 }));
    const status: AttemptStatus = failedFirst ? "failed" : "passed";
    const scorePct = Math.round((correctCount / total) * 100);

    attempts.push({
      id: `att-${counter++}`,
      managerId: m.id,
      moduleSlug: mod.slug,
      pool,
      status,
      startedAt,
      submittedAt: new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString(),
      scorePct,
      correctCount,
      totalCount: total,
      durationSec,
      answers: approvedQuestions.slice(0, total).map((q) => {
        const correctOpt = q.options.find((o) => o.correct)!;
        const wrongOpt = q.options.find((o) => !o.correct)!;
        const answerCorrect = faker.datatype.boolean(scorePct / 100);
        return {
          questionId: q.id,
          selectedOptionId: answerCorrect ? correctOpt.id : wrongOpt.id,
          correct: answerCorrect,
        };
      }),
    });

    // If failed, add a retake (easier) attempt
    if (failedFirst) {
      const retakeStart = new Date(new Date(startedAt).getTime() + faker.number.int({ min: 1, max: 7 }) * 86400000).toISOString();
      const retakeDuration = faker.number.int({ min: 500, max: 1500 });
      const retakePass = faker.datatype.boolean(0.7);
      const retakeApproved = questionsForModule(mod.slug, "retake").filter((q) => q.status === "approved");
      const rcc = retakePass
        ? Math.floor(total * faker.number.float({ min: 0.86, max: 0.95 }))
        : Math.floor(total * faker.number.float({ min: 0.6, max: 0.8 }));
      attempts.push({
        id: `att-${counter++}`,
        managerId: m.id,
        moduleSlug: mod.slug,
        pool: "retake",
        status: retakePass ? "passed" : "failed",
        startedAt: retakeStart,
        submittedAt: new Date(new Date(retakeStart).getTime() + retakeDuration * 1000).toISOString(),
        scorePct: Math.round((rcc / total) * 100),
        correctCount: rcc,
        totalCount: total,
        durationSec: retakeDuration,
        answers: retakeApproved.slice(0, total).map((q) => {
          const correctOpt = q.options.find((o) => o.correct)!;
          const wrongOpt = q.options.find((o) => !o.correct)!;
          const answerCorrect = faker.datatype.boolean((rcc / total));
          return {
            questionId: q.id,
            selectedOptionId: answerCorrect ? correctOpt.id : wrongOpt.id,
            correct: answerCorrect,
          };
        }),
      });
    }
  }
}

export const attemptsForManager = (managerId: string) =>
  attempts.filter((a) => a.managerId === managerId);

export const attemptsForModule = (slug: string) =>
  attempts.filter((a) => a.moduleSlug === slug);
