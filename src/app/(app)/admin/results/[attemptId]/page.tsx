import { notFound } from "next/navigation";
import { getAttempt } from "@/lib/db/attempts";
import { getProfile } from "@/lib/db/profiles";
import { getModule } from "@/lib/db/modules";
import { listQuestionsForModule } from "@/lib/db/questions";
import { listDeliveriesForModule } from "@/lib/db/deliveries";
import { AttemptDetailView } from "./attempt-view";
import type { Manager } from "@/types";

export default async function AttemptDetailPage(props: PageProps<"/admin/results/[attemptId]">) {
  const { attemptId } = await props.params;
  const attempt = await getAttempt(attemptId);
  if (!attempt) return notFound();

  const [profile, mod, questions, deliveries] = await Promise.all([
    getProfile(attempt.managerId),
    getModule(attempt.moduleSlug),
    listQuestionsForModule(attempt.moduleSlug),
    listDeliveriesForModule(attempt.moduleSlug),
  ]);

  if (!profile || profile.role !== "manager" || !mod) return notFound();
  const m = profile as Manager;

  return <AttemptDetailView attempt={attempt} m={m} mod={mod} questions={questions} deliveries={deliveries} />;
}
