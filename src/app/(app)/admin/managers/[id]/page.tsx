import { notFound } from "next/navigation";
import { getProfile, listTeachers } from "@/lib/db/profiles";
import { listModules } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { listDeliveriesForModule, type DeliveryRecord } from "@/lib/db/deliveries";
import { ManagerDetailView } from "./detail-view";
import type { Manager } from "@/types";

export default async function ManagerDetailPage(props: PageProps<"/admin/managers/[id]">) {
  const { id } = await props.params;
  const profile = await getProfile(id);
  if (!profile || profile.role !== "manager") return notFound();

  const [modules, myAttempts, teachers] = await Promise.all([
    listModules(),
    listAttemptsForManager(id),
    listTeachers(),
  ]);
  const teacherNamesById: Record<string, string> = {};
  for (const t of teachers) teacherNamesById[t.id] = t.name;

  // Compute derived stats.
  const passed = myAttempts.filter((a) => a.status === "passed");
  const failed = myAttempts.filter((a) => a.status === "failed");
  const passedSlugs = new Set(passed.map((a) => a.moduleSlug));
  const modulesCompleted = passedSlugs.size;
  const averageScore =
    passed.length === 0 ? 0 : Math.round(passed.reduce((s, a) => s + Number(a.scorePct), 0) / passed.length);

  // Compute flagged reasons (same logic as at-risk page).
  const failedRetakes = myAttempts.filter((a) => a.status === "failed" && a.pool === "retake").length;
  const lowFirstAttempts = myAttempts.filter((a) => a.pool === "first-attempt" && a.scorePct > 0 && a.scorePct < 70).length;
  const flaggedReasons: string[] = [];
  if (profile.status === "at-risk") {
    if (failedRetakes > 0) flaggedReasons.push(`Failed retake on ${failedRetakes} module${failedRetakes === 1 ? "" : "s"}`);
    if (lowFirstAttempts > 0) flaggedReasons.push(`First attempt below 70% on ${lowFirstAttempts} module${lowFirstAttempts === 1 ? "" : "s"}`);
    if (myAttempts.length === 0) flaggedReasons.push("No quiz attempts logged yet");
    const lastActiveMs = new Date(profile.lastActiveAt).getTime();
    if (Date.now() - lastActiveMs > 14 * 24 * 3600 * 1000) flaggedReasons.push("Has not logged in for 14+ days");
  }

  const m: Manager = {
    ...profile,
    modulesCompleted,
    averageScore,
    failedAttempts: failed.length,
    flaggedReasons,
  };

  // Pre-fetch delivery history for every module the manager has attempted,
  // so the attempt list can label which delivery each attempt fell into.
  const attemptedSlugs = Array.from(new Set(myAttempts.map((a) => a.moduleSlug)));
  const deliveriesLists = await Promise.all(attemptedSlugs.map((s) => listDeliveriesForModule(s)));
  const deliveriesByModule: Record<string, DeliveryRecord[]> = {};
  attemptedSlugs.forEach((slug, i) => { deliveriesByModule[slug] = deliveriesLists[i]; });

  return (
    <ManagerDetailView
      m={m}
      modules={modules}
      myAttempts={myAttempts}
      deliveriesByModule={deliveriesByModule}
      teacherNamesById={teacherNamesById}
    />
  );
}
