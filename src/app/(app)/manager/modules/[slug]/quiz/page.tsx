import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { listModuleSopsForUser } from "@/lib/db/module-resources";
import { ManagerQuizView } from "./quiz-view";

export default async function ManagerQuizPage(props: PageProps<"/manager/modules/[slug]/quiz">) {
  const { slug } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const mod = await getModule(slug);
  if (!mod) return notFound();

  // SOP gate — must hold here too, not just on the module page: the dashboard
  // "Take quiz" CTA (and a direct URL) link straight to the quiz and would
  // otherwise bypass it. If any linked SOP is unsigned (and they haven't already
  // passed), send them to the module page where the SOP banner lets them sign.
  const [sops, attempts] = await Promise.all([
    listModuleSopsForUser(slug, me.id),
    listAttemptsForManager(me.id),
  ]);
  const alreadyPassed = attempts.some((a) => a.moduleSlug === slug && a.status === "passed");
  const allSopsSigned = sops.every((s) => s.signed);
  if (!allSopsSigned && !alreadyPassed) {
    redirect(`/manager/modules/${slug}`);
  }

  return <ManagerQuizView mod={mod} />;
}
