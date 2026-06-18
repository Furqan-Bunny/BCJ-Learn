import { notFound } from "next/navigation";
import { getAttempt } from "@/lib/db/attempts";
import { listAssignableUsers } from "@/lib/db/profiles";
import { getModule } from "@/lib/db/modules";
import { listQuestionsForModule } from "@/lib/db/questions";
import { listDeliveriesForModule } from "@/lib/db/deliveries";
import { AttemptDetailView } from "./attempt-view";

export default async function AttemptDetailPage(props: PageProps<"/admin/results/[attemptId]">) {
  const { attemptId } = await props.params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return notFound();

  // Resolve the taker via listAssignableUsers (Manager shape for ANY role) so a
  // Department Lead's / Admin's own attempt is viewable too — not just managers.
  const [users, mod, questions, deliveries] = await Promise.all([
    listAssignableUsers(),
    getModule(attempt.moduleSlug),
    listQuestionsForModule(attempt.moduleSlug),
    listDeliveriesForModule(attempt.moduleSlug),
  ]);

  const m = users.find((u) => u.id === attempt.managerId);
  if (!m || !mod) return notFound();

  return <AttemptDetailView attempt={attempt} m={m} mod={mod} questions={questions} deliveries={deliveries} />;
}
