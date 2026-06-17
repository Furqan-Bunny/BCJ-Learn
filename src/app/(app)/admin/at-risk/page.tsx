import { atRiskManagers } from "@/lib/db/queries";
import { listAttempts } from "@/lib/db/attempts";
import { getEmailTemplate } from "@/lib/db/email-templates";
import { AtRiskView } from "./at-risk-view";

export default async function AtRiskPage() {
  const [list, allAttempts, reminderTpl] = await Promise.all([
    atRiskManagers(),
    listAttempts(),
    getEmailTemplate("overdue_reminder"),
  ]);

  // Derive flagged reasons from attempts for each at-risk manager.
  const enriched = list.map((m) => {
    const mine = allAttempts.filter((a) => a.managerId === m.id);
    const failedRetakes = mine.filter((a) => a.status === "failed" && a.pool === "retake").length;
    const failedFirstAttempts = mine.filter((a) => a.status === "failed" && a.pool === "first-attempt").length;
    const passed = mine.filter((a) => a.status === "passed");
    const lowFirstAttempts = mine.filter((a) => a.pool === "first-attempt" && a.scorePct > 0 && a.scorePct < 70).length;
    // Has the manager actually started a retake (a scheduled placeholder doesn't count)?
    const retakeTaken = mine.some((a) => a.pool === "retake" && a.status !== "scheduled");

    const reasons: string[] = [];
    if (failedRetakes > 0) reasons.push(`Failed retake on ${failedRetakes} module${failedRetakes === 1 ? "" : "s"}`);
    if (failedFirstAttempts > 0 && failedRetakes === 0 && !retakeTaken) reasons.push("Overdue retake — failed but hasn't retaken yet");
    if (lowFirstAttempts > 0) reasons.push(`First attempt below 70% on ${lowFirstAttempts} module${lowFirstAttempts === 1 ? "" : "s"}`);
    if (mine.length === 0) reasons.push("No quiz attempts logged yet");
    const lastActiveMs = new Date(m.lastActiveAt).getTime();
    if (Date.now() - lastActiveMs > 14 * 24 * 3600 * 1000) reasons.push("Has not logged in for 14+ days");

    return {
      ...m,
      flaggedReasons: reasons,
      modulesCompleted: new Set(passed.map((a) => a.moduleSlug)).size,
      averageScore: passed.length === 0 ? 0 : Math.round(passed.reduce((s, a) => s + Number(a.scorePct), 0) / passed.length),
      failedAttempts: failedFirstAttempts + failedRetakes,
    };
  });

  return (
    <AtRiskView
      list={enriched}
      reminderSubject={reminderTpl?.subject ?? "A reminder about your BCJ training"}
      reminderBody={reminderTpl?.bodyMarkdown ?? "Hi {{name}}, this is a reminder to complete your assigned BCJ training module."}
    />
  );
}
