import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule } from "@/lib/db/modules";
import { getProfile } from "@/lib/db/profiles";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCheckedInStatus, getCurrentDelivery } from "@/lib/db/deliveries";
import { ManagerModuleView } from "./module-view";

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
    />
  );
}
