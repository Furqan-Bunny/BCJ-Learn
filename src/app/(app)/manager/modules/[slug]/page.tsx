import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule } from "@/lib/db/modules";
import { getProfile } from "@/lib/db/profiles";
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
  const [me, mod] = await Promise.all([
    getCurrentUserForRole("manager"),
    getModule(slug),
  ]);
  if (!me) redirect("/login");
  if (!mod) return notFound();

  const totalMinutes = mod.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);

  // Primary teacher (first owner if any).
  const primaryTeacherId = mod.ownerTeacherIds[0];
  let teacher: { id: string; name: string; bio: string } | null = null;
  if (primaryTeacherId) {
    const profile = await getProfile(primaryTeacherId);
    if (profile && profile.role === "teacher") {
      teacher = { id: profile.id, name: profile.name, bio: profile.bio };
    }
  }

  const [allMyAttempts, checkInStatus, delivery, moduleSops] = await Promise.all([
    listAttemptsForManager(me.id),
    getCheckedInStatus(slug, me.id),
    getCurrentDelivery(slug),
    listModuleSopsForUser(slug, me.id),
  ]);
  const myAttempts = allMyAttempts.filter((a) => a.moduleSlug === slug);
  const alreadyPassed = myAttempts.some((a) => a.status === "passed");

  // Hard gate: every linked SOP for this module must be signed at its current
  // version before the employee can open materials or take the quiz. Passing
  // the module previously also unlocks (legacy back-fill).
  const allSopsSigned = moduleSops.every((s) => s.signed);
  const sopsCleared = allSopsSigned || alreadyPassed;

  // Materials are seminar-only AND SOP-gated. Until both gates pass, strip the
  // content so it can't be read from the page source / network.
  const canViewMaterials = sopsCleared && (checkInStatus.checkedIn || alreadyPassed);
  const safeMod = canViewMaterials
    ? mod
    : {
        ...mod,
        lessons: mod.lessons.map((l) => ({
          ...l,
          contents: l.contents.map((c) => ({
            id: c.id,
            type: c.type,
            title: c.title,
            durationMinutes: c.durationMinutes,
          })),
        })),
      };

  return (
    <ManagerModuleView
      mod={safeMod}
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
