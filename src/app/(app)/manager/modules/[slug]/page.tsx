import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule } from "@/lib/db/modules";
import { getProfile } from "@/lib/db/profiles";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCheckedInStatus, getCurrentDelivery } from "@/lib/db/deliveries";
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

  const [allMyAttempts, checkInStatus, delivery] = await Promise.all([
    listAttemptsForManager(me.id),
    getCheckedInStatus(slug, me.id),
    getCurrentDelivery(slug),
  ]);
  const myAttempts = allMyAttempts.filter((a) => a.moduleSlug === slug);

  // Materials are seminar-only. Until the employee checks in at the live
  // session (or has already passed), DON'T send the actual content to the
  // browser at all — strip document text, slides, file paths, and media URLs so
  // it can't be read from the page source / network. The outline (titles, type,
  // duration) is kept so they can see what the seminar covers.
  const canViewMaterials = checkInStatus.checkedIn || myAttempts.some((a) => a.status === "passed");
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
    />
  );
}
