import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule, getModulesBySlugs } from "@/lib/db/modules";
import { getModuleTrainer } from "@/lib/db/profiles";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCheckedInStatus, getCurrentDelivery } from "@/lib/db/deliveries";
import { listModuleSopsForUser } from "@/lib/db/module-resources";
import { ManagerModuleView } from "./module-view";
import type { Metadata } from "next";

export async function generateMetadata(props: PageProps<"/manager/modules/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return { title: "Module" };
  return { title: `${mod.title} — Module ${mod.number}`, description: mod.description };
}

export default async function ManagerModulePage(props: PageProps<"/manager/modules/[slug]">) {
  const { slug } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [allMyAttempts, checkInStatus, delivery, moduleSops] = await Promise.all([
    listAttemptsForManager(me.id),
    getCheckedInStatus(slug, me.id),
    getCurrentDelivery(slug),
    listModuleSopsForUser(slug, me.id),
  ]);
  const myAttempts = allMyAttempts.filter((a) => a.moduleSlug === slug);

  // Serve module title/description in the employee's language (English fallback).
  // If the manager can't read it via RLS (e.g. it's no longer published) but they
  // have already engaged with it, resolve it via service-role so a passed module
  // stays openable from their list.
  let mod = await getModule(slug, me.locale);
  if (!mod && myAttempts.length > 0) {
    mod = (await getModulesBySlugs([slug], me.locale))[0] ?? null;
  }
  if (!mod) return notFound();

  const totalMinutes = mod.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);

  // Primary teacher (first owner if any). Fetched via getModuleTrainer because
  // managers have no RLS read on staff profiles — it returns only name + bio.
  const primaryTeacherId = mod.ownerTeacherIds[0];
  const teacher = primaryTeacherId ? await getModuleTrainer(primaryTeacherId) : null;

  // Content is pre-study material: any assigned employee can read it before the
  // seminar. The QUIZ stays gated (required resources signed + seminar/check-in)
  // — that's enforced by the quiz page + the quiz status card, not here.
  return (
    <ManagerModuleView
      mod={mod}
      totalMinutes={totalMinutes}
      teacher={teacher}
      managerId={me.id}
      myAttempts={myAttempts}
      isCheckedIn={checkInStatus.checkedIn}
      sessionStartedAt={delivery?.sessionStartedAt ?? null}
      sessionEndedAt={delivery?.sessionEndedAt ?? null}
      checkinOpen={!!delivery?.checkinOpenedAt}
      managerName={me.name}
      moduleSops={moduleSops}
    />
  );
}
