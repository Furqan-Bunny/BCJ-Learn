import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getAttempt } from "@/lib/db/attempts";
import { listQuestionsForModule } from "@/lib/db/questions";
import { getModule } from "@/lib/db/modules";
import { ManagerAttemptView } from "./attempt-view";

export default async function ManagerAttemptPage(props: PageProps<"/manager/attempts/[attemptId]">) {
  const { attemptId } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const attempt = await getAttempt(attemptId);
  if (!attempt) return notFound();
  // Authorise: only the employee who took this attempt can view it.
  if (attempt.managerId !== me.id) return notFound();

  const [mod, questions] = await Promise.all([
    getModule(attempt.moduleSlug),
    listQuestionsForModule(attempt.moduleSlug),
  ]);

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
