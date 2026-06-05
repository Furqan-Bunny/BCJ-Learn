import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getAttempt } from "@/lib/db/attempts";
import { listQuestionsForModuleAsAdmin } from "@/lib/db/questions";
import { getModule } from "@/lib/db/modules";
import { ManagerAttemptView } from "./attempt-view";
import type { Question } from "@/types";

export default async function ManagerAttemptPage(props: PageProps<"/manager/attempts/[attemptId]">) {
  const { attemptId } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const attempt = await getAttempt(attemptId);
  if (!attempt) return notFound();
  // Authorise: only the employee who took this attempt can view it.
  if (attempt.managerId !== me.id) return notFound();

  // Managers have no RLS read access to `questions` (prevents answer leakage
  // mid-quiz). The reviewer owns this submitted attempt, so fetch the question
  // text via the service-role client. We only need the questions they answered.
  const answeredIds = new Set(attempt.answers.map((a) => a.questionId));
  const [mod, allQuestions] = await Promise.all([
    getModule(attempt.moduleSlug, me.locale),
    listQuestionsForModuleAsAdmin(attempt.moduleSlug),
  ]);

  const passed = attempt.status === "passed";
  const questions: Question[] = allQuestions
    .filter((q) => answeredIds.has(q.id))
    .map((q) =>
      passed
        ? q
        : // Failed review hides the correct answer + explanation — strip them
          // from the payload entirely so they can't be read from the network.
          {
            ...q,
            explanation: undefined,
            options: q.options.map((o) => ({ ...o, correct: false })),
          },
    );

  return (
    <ManagerAttemptView
      attempt={attempt}
      moduleTitle={mod?.title ?? attempt.moduleSlug}
      moduleNumber={mod?.number ?? null}
      passThreshold={mod?.passThreshold ?? 0.85}
      firstName={me.name.split(" ")[0]}
      questions={questions}
    />
  );
}
