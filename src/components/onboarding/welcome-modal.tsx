"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, Trophy, User } from "lucide-react";
import { useCurrentUser } from "@/lib/supabase/use-user";
import { createClient } from "@/lib/supabase/client";

/**
 * One-time welcome modal shown after a user accepts their invite + finishes
 * onboarding. Displayed on their first authenticated page render; dismissal
 * sets profiles.onboarded_at so it never shows again.
 *
 * Demo mode: never shows (profile fields aren't persisted anyway).
 */
export function WelcomeModal() {
  const { user, isDemoMode } = useCurrentUser();
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  // Check on mount whether the current user has been onboarded.
  React.useEffect(() => {
    if (isDemoMode || !user || checked) return;
    let cancelled = false;
    const sb = createClient();
    void sb
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { onboarded_at?: string | null } | null;
        if (row && !row.onboarded_at) setOpen(true);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, user, checked]);

  async function dismiss() {
    setOpen(false);
    if (!user || isDemoMode) return;
    const sb = createClient();
    await sb.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void dismiss(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mx-auto mb-3">
            <Sparkles className="size-6" />
          </div>
          <DialogTitle className="text-2xl text-center">Welcome to BCJ Learn, {user.name.split(" ")[0]}</DialogTitle>
          <DialogDescription className="text-center">
            Quick orientation before you dive in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Item
            icon={BookOpen}
            title="Your modules"
            body="Find the training modules assigned to you on the dashboard. Each one has content to study and a quiz at the end."
          />
          <Item
            icon={Trophy}
            title="The 85% bar"
            body="Pass each module's quiz with 85% or higher. Fail once and a retake is auto-scheduled with an easier question set."
          />
          <Item
            icon={User}
            title="Your profile"
            body="Click your avatar (top right) any time to update your photo, change your password, or sign out."
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={dismiss}>Got it — let&rsquo;s go</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="size-9 rounded-md bg-muted flex items-center justify-center text-primary shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}
