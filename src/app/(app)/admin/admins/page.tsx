import { listAdmins } from "@/lib/db/profiles";
import { listActivity } from "@/lib/db/activity";
import { AdminAdminsView } from "./admins-view";
import type { ActivityEvent } from "@/types";

export default async function AdminAdminsPage() {
  const [admins, activity] = await Promise.all([listAdmins(), listActivity()]);

  const activityByActor: Record<string, ActivityEvent[]> = {};
  for (const e of activity) {
    if (!e.actorId) continue;
    (activityByActor[e.actorId] ??= []).push(e);
  }

  return <AdminAdminsView admins={admins} activityByActor={activityByActor} />;
}
