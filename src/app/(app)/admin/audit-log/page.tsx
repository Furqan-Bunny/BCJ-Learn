import { listActivity } from "@/lib/db/activity";
import { listAllProfiles } from "@/lib/db/profiles";
import { AuditLogView } from "./audit-log-view";

export default async function AuditLogPage() {
  const [events, profiles] = await Promise.all([listActivity(), listAllProfiles()]);

  const actorsById: Record<string, { id: string; name: string; avatarColor: string }> = {};
  for (const p of profiles) {
    actorsById[p.id] = { id: p.id, name: p.name, avatarColor: p.avatarColor };
  }

  return <AuditLogView events={events} actorsById={actorsById} />;
}
