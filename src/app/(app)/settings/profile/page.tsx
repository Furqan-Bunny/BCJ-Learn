// Server component — fetches the current user's profile, renders the form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "./profile-form";
import { ActivityHistory } from "./activity-history";
import { listActivityForUser } from "@/lib/db/activity";
import { listAttemptsForManager } from "@/lib/db/attempts";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default async function ProfilePage() {
  // In demo mode the role-store drives identity; redirect because real profile
  // editing requires a real auth session.
  if (DEMO_MODE) {
    return (
      <>
        <PageHeader
          eyebrow="Settings"
          title="My profile"
          description="In demo mode, profiles are mocked. Sign in via production mode (NEXT_PUBLIC_DEMO_MODE=false) to edit your real profile."
        />
        <div className="max-w-2xl rounded-lg border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 p-5 text-sm">
          The profile editor is disabled in demo mode. To test it, flip{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_DEMO_MODE=false</code>{" "}
          and sign in as a seeded user (e.g. <code>nancy@bcj.com</code>).
        </div>
      </>
    );
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const p = profile as {
    id: string;
    name: string;
    email: string;
    role: Role;
    cohort: string | null;
    avatar_color: string;
    avatar_url: string | null;
    bio: string | null;
    title: string | null;
    joined_at: string;
    last_active_at: string;
    phone: string | null;
    notification_prefs: { quiz_results?: boolean; training_reminders?: boolean; at_risk_alerts?: boolean } | null;
    two_factor_enabled: boolean | null;
  };

  const [activity, attempts] = await Promise.all([
    listActivityForUser(p.id, 10),
    p.role === "manager" ? listAttemptsForManager(p.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="My profile"
        description="Update your name, photo, password, and account preferences."
      />
      <ProfileForm
        initial={{
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          cohort: p.cohort,
          avatarColor: p.avatar_color,
          avatarUrl: p.avatar_url,
          bio: p.bio,
          title: p.title,
          joinedAt: p.joined_at,
          lastActiveAt: p.last_active_at,
          phone: p.phone,
          notificationPrefs: {
            quizResults: p.notification_prefs?.quiz_results ?? true,
            trainingReminders: p.notification_prefs?.training_reminders ?? true,
            atRiskAlerts: p.notification_prefs?.at_risk_alerts ?? true,
          },
          twoFactorEnabled: p.two_factor_enabled ?? false,
        }}
      />
      <ActivityHistory activity={activity} attempts={attempts} role={p.role} />
    </>
  );
}
