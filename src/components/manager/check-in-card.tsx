"use client";

import * as React from "react";
import { CheckCircle2, MapPin, Calendar, Clock, ArrowRight, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAttendanceStore } from "@/store/attendance-store";
import { fmtDate, fmtRelative } from "@/lib/format";
import type { ModuleDef } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CheckInCardProps {
  manager: { id: string; name: string };
  mod: ModuleDef;
  /** Demo control: hide the card entirely if today != training day in real life. Default: always show in demo. */
  alwaysShow?: boolean;
}

export function CheckInCard({ manager, mod, alwaysShow = true }: CheckInCardProps) {
  const checkedInMap = useAttendanceStore((s) => s.checkedIn);
  const checkedInAtMap = useAttendanceStore((s) => s.checkedInAt);
  const inviteesMap = useAttendanceStore((s) => s.invitees);
  const sessionStartedAtMap = useAttendanceStore((s) => s.sessionStartedAt);
  const sessionEndedAtMap = useAttendanceStore((s) => s.sessionEndedAt);
  const checkIn = useAttendanceStore((s) => s.checkIn);
  const checkOut = useAttendanceStore((s) => s.checkOut);
  const isCheckedIn = (checkedInMap[mod.slug] ?? []).includes(manager.id);
  const checkedInAt = checkedInAtMap[`${mod.slug}:${manager.id}`];
  const sessionStartedAt = sessionStartedAtMap[mod.slug];
  const sessionEndedAt = sessionEndedAtMap[mod.slug];
  const sessionLive = !!sessionStartedAt && !sessionEndedAt;

  // Auto-invitation: if invitees has been overridden (after a re-delivery), only show
  // the check-in card to managers actually invited. If no override, default = everyone
  // is invited (matches scope §5.3).
  const explicitInvitees = inviteesMap[mod.slug];
  const isInvited = !explicitInvitees || explicitInvitees.includes(manager.id);
  if (!isInvited) return null;

  // Once the session has ended, the check-in flow is no longer relevant —
  // the QuizStatusCard takes over with "Start Quiz".
  if (sessionEndedAt) return null;

  const trainingDate = new Date(mod.scheduledDate);
  const now = new Date();
  const isToday =
    trainingDate.getFullYear() === now.getFullYear() &&
    trainingDate.getMonth() === now.getMonth() &&
    trainingDate.getDate() === now.getDate();

  if (!alwaysShow && !isToday) return null;

  function handleCheckIn() {
    checkIn(mod.slug, manager.id);
    toast.success(`You're checked in for ${mod.title}`, {
      description: "Sit tight — the quiz unlocks right after the seminar.",
    });
  }

  function handleUndo() {
    checkOut(mod.slug, manager.id);
    toast("Check-in removed");
  }

  // Already checked in → confirmed state
  if (isCheckedIn) {
    return (
      <Card className="overflow-hidden border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/15">
        <div className="h-1 bg-emerald-500" />
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 mb-1">
                You're checked in
              </Badge>
              <div className="font-semibold text-lg">Welcome to {mod.title}</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Checked in {checkedInAt ? fmtRelative(checkedInAt) : "just now"} · Sit tight, the quiz unlocks right after the seminar.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleUndo} className="shrink-0">
              Undo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not yet checked in
  return (
    <Card className={cn(
      "overflow-hidden",
      sessionLive ? "border-rose-500/50 ring-2 ring-rose-500/20" : "border-[var(--gold)]/40",
    )}>
      <div className={cn("h-1", sessionLive ? "bg-rose-500" : "bg-[var(--gold)]")} />
      <CardContent className="p-5">
        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {sessionLive ? (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 uppercase tracking-wider text-[10px] gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Live now
                </Badge>
              ) : (
                <Badge className="bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 uppercase tracking-wider text-[10px]">
                  Today's session
                </Badge>
              )}
            </div>
            <div className="font-semibold text-lg">{mod.title}</div>
            <p className="text-sm text-muted-foreground mt-0.5 mb-3">
              {sessionLive
                ? "Your trainer started the seminar — check in so they know you're here."
                : "You're in the room — confirm so your trainer knows you're here."}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {fmtDate(mod.scheduledDate)}</span>
              <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {mod.lessons.reduce((s, l) => s + l.durationMinutes, 0)} min seminar</span>
              <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Atlanta HQ Training Room</span>
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleCheckIn}
            className="h-14 px-6 text-base bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-slate-900 shadow-md"
          >
            <UserCheck className="size-5 mr-2" />
            I&rsquo;m here — check me in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ModuleCheckInPillProps {
  manager: { id: string; name: string };
  moduleSlug: string;
  onCheckIn?: () => void;
}

/** Compact "checked in" pill for use in the manager's own roster row, dashboard sidebar, etc. */
export function ModuleCheckInPill({ manager, moduleSlug }: ModuleCheckInPillProps) {
  const checkedInMap = useAttendanceStore((s) => s.checkedIn);
  const isCheckedIn = (checkedInMap[moduleSlug] ?? []).includes(manager.id);
  if (!isCheckedIn) return null;
  return (
    <Badge className={cn(
      "bg-emerald-100 text-emerald-800 border-emerald-200",
      "dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
    )}>
      <CheckCircle2 className="size-3 mr-1" />
      Checked in
    </Badge>
  );
}
