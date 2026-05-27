import { listRecentNotifications } from "@/lib/db/notifications";
import { getReminderRules } from "@/lib/db/settings";
import { listAllProfiles } from "@/lib/db/profiles";
import { listEmailTemplates } from "@/lib/db/email-templates";
import { NotificationsView } from "./notifications-view";
import type { Manager, Teacher, Admin } from "@/types";

export default async function AdminNotifications() {
  const [recent, rules, profiles, templates] = await Promise.all([
    listRecentNotifications(20),
    getReminderRules(),
    listAllProfiles(),
    listEmailTemplates(),
  ]);

  const profilesById: Record<string, { id: string; name: string; avatarColor: string }> = {};
  for (const p of profiles as (Manager | Teacher | Admin)[]) {
    profilesById[p.id] = { id: p.id, name: p.name, avatarColor: p.avatarColor };
  }

  return (
    <NotificationsView
      recent={recent}
      initialRules={rules}
      profilesById={profilesById}
      templates={templates}
    />
  );
}
