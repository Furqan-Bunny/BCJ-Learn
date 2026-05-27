"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, Calendar, Clock, UserCheck, Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtRelative } from "@/lib/format";
import type { ModuleDef } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logCheckIn, logCheckOut } from "@/lib/server/attendance-actions";

interface CheckInCardProps {
  manager: { id: string; name: string };
  mod: ModuleDef;
  /** Provided by the host page from the DB; whether the manager is currently checked in. */
  initialCheckedIn?: boolean;
  initialCheckedInAt?: string | null;
  /** Live session state from the current delivery row. */
  sessionStartedAt?: string | null;
  sessionEndedAt?: string | null;
  /** Whether the trainer has opened check-in (employees can check in now). */
  checkinOpen?: boolean;
  /** Demo control: hide the card entirely if today != training day. Default: always show. */
  alwaysShow?: boolean;
}

export function CheckInCard({
  manager,
  mod,
  initialCheckedIn = false,
  initialCheckedInAt = null,
  sessionStartedAt = null,
  sessionEndedAt = null,
  checkinOpen = false,
  alwaysShow = true,
}: CheckInCardProps) {
  const router = useRouter();
  const [isCheckedIn, setIsCheckedIn] = React.useState(initialCheckedIn);
  const [checkedInAt, setCheckedInAt] = React.useState<string | null>(initialCheckedInAt);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");

  const sessionLive = !!sessionStartedAt && !sessionEndedAt;

  // Once the session has ended, the check-in flow is no longer relevant —
  // the QuizStatusCard takes over with "Start Quiz".
  if (sessionEndedAt) return null;

  const trainingDate = mod.scheduledDate ? new Date(mod.scheduledDate) : null;
  const now = new Date();
  const isToday = trainingDate
    ? trainingDate.getFullYear() === now.getFullYear() &&
      trainingDate.getMonth() === now.getMonth() &&
      trainingDate.getDate() === now.getDate()
    : false;

  if (!alwaysShow && !isToday) return null;

  async function handleCheckIn() {
    if (code.trim().length < 4) {
      toast.error("Enter the 4-digit code shown on the room screen");
      return;
    }
    setBusy(true);
    const res = await logCheckIn(mod.slug, code.trim());
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not check in");
      return;
    }
    setIsCheckedIn(true);
    setCheckedInAt(new Date().toISOString());
    toast.success(`You're checked in for ${mod.title}`, {
      description: "Sit tight — the quiz unlocks right after the seminar.",
    });
    router.refresh();
  }

  async function handleUndo() {
    setBusy(true);
    const res = await logCheckOut(mod.slug);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not undo");
      return;
    }
    setIsCheckedIn(false);
    setCheckedInAt(null);
    toast("Check-in removed");
    router.refresh();
  }

  if (isCheckedIn) {
    return (
      <Card className="relative overflow-hidden border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/15">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 mb-1">
                You&rsquo;re checked in
              </Badge>
              <div className="font-semibold text-lg">Welcome to {mod.title}</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Checked in {checkedInAt ? fmtRelative(checkedInAt) : "just now"} · Sit tight, the quiz unlocks right after the seminar.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleUndo} className="shrink-0" disabled={busy}>
              {busy ? "…" : "Undo"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Trainer hasn't opened check-in yet — show a calm "waiting" state so nobody
  // can check in before the seminar actually starts.
  if (!checkinOpen) {
    return (
      <Card className="relative overflow-hidden border-[var(--gold)]/30">
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--gold)]/50" />
        <CardContent className="p-5 flex items-start gap-4">
          <div className="size-12 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] flex items-center justify-center shrink-0">
            <Lock className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-1">Check-in not open yet</Badge>
            <div className="font-semibold text-lg">{mod.title}</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Check-in opens when your trainer starts the seminar. You&rsquo;ll get a code on the room screen — enter it here to check in.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "relative overflow-hidden",
      sessionLive ? "border-rose-500/50 ring-2 ring-rose-500/20" : "border-[var(--gold)]/40",
    )}>
      <div className={cn("absolute inset-x-0 top-0 h-1", sessionLive ? "bg-rose-500" : "bg-[var(--gold)]")} />
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
                  Today&rsquo;s session
                </Badge>
              )}
            </div>
            <div className="font-semibold text-lg">{mod.title}</div>
            <p className="text-sm text-muted-foreground mt-0.5 mb-3">
              Enter the code shown on the room screen to check in. Only people in the room can.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {mod.scheduledDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> {fmtDate(mod.scheduledDate)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> {mod.lessons.reduce((s, l) => s + l.durationMinutes, 0)} min seminar
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> Atlanta HQ Training Room
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:w-44">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="Code"
              aria-label="Check-in code"
              className="h-12 text-center text-xl font-mono tracking-[0.3em]"
            />
            <Button
              size="lg"
              onClick={handleCheckIn}
              disabled={busy || code.trim().length < 4}
              className="h-12 px-6 text-base bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-slate-900 shadow-md"
            >
              {busy ? <Loader2 className="size-5 mr-2 animate-spin" /> : <UserCheck className="size-5 mr-2" />}
              Check in
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ModuleCheckInPillProps {
  manager: { id: string; name: string };
  moduleSlug: string;
  checkedIn?: boolean;
}

/** Compact "checked in" pill — receives state as a prop. */
export function ModuleCheckInPill({ checkedIn = false }: ModuleCheckInPillProps) {
  if (!checkedIn) return null;
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
