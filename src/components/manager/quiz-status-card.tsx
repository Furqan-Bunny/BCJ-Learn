"use client";

import Link from "next/link";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Calendar, RefreshCcw,
  Target, Trophy, ArrowRight, Lock, Sparkles, UserCheck, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeQuizState } from "@/lib/quiz-state";
import { fmtDate, fmtRelative, fmtPct, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModuleDef, Attempt } from "@/types";

interface QuizStatusCardProps {
  managerId: string;
  mod: ModuleDef;
  /** All attempts for this manager+module across deliveries (props from server). */
  myAttempts: Attempt[];
  /** Whether the manager is checked in to the current delivery. */
  isCheckedIn: boolean;
  /** Whether this manager is invited to the current delivery. Default true. */
  isInvited?: boolean;
  /** Current delivery's session lifecycle timestamps (null if not started/ended). */
  sessionStartedAt?: string | null;
  sessionEndedAt?: string | null;
  /** Compact variant for sidebar/dashboard cards. */
  variant?: "compact" | "full";
}

export function QuizStatusCard({
  managerId,
  mod,
  myAttempts,
  isCheckedIn,
  isInvited = true,
  sessionStartedAt = null,
  sessionEndedAt = null,
  variant = "full",
}: QuizStatusCardProps) {
  void managerId; // not used directly; attempts already filtered by host
  const sessionLive = !!sessionStartedAt && !sessionEndedAt;
  const timeStr = fmtTime(mod.scheduledTime);

  const state = computeQuizState({
    currentAttempts: myAttempts,
    scheduledDate: mod.scheduledDate,
    isCheckedIn,
    sessionEnded: !!sessionEndedAt,
  });

  if (!isInvited && state.kind !== "passed") {
    return (
      <StatusContainer
        variant={variant}
        accent="slate"
        icon={Lock}
        eyebrow="Not in this delivery"
        title={`You're not assigned to the next ${mod.title} delivery`}
        description="The next delivery is for retakes and new hires. If you think this is wrong, talk to your trainer."
        primaryAction={null}
        meta={[
          { icon: Calendar, label: "Next delivery", value: mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—" },
        ]}
      />
    );
  }

  if (state.kind === "passed") {
    return (
      <StatusContainer
        variant={variant}
        accent="emerald"
        icon={Trophy}
        eyebrow="You passed this module"
        title={`You scored ${fmtPct(state.passedAttempt.scorePct)} on ${mod.title}`}
        description="You don't need to retake the quiz. BCJ recommends an annual refresher to keep the material fresh."
        primaryAction={
          <Button asChild variant="outline">
            <Link href={`/manager/modules/${mod.slug}/certificate`}>
              <Award className="size-4 mr-1.5" /> View certificate
            </Link>
          </Button>
        }
        meta={[
          { icon: CheckCircle2, label: "Passed on", value: fmtDate(state.passedAttempt.submittedAt ?? state.passedAttempt.startedAt) },
          { icon: Calendar, label: "Refresher", value: fmtDate(state.refresherDueDate) },
        ]}
      />
    );
  }

  if (state.kind === "needs-retake") {
    return (
      <StatusContainer
        variant={variant}
        accent="amber"
        icon={RefreshCcw}
        eyebrow="Retake available"
        title={`You scored ${fmtPct(state.failedAttempt.scorePct)} — needed ${Math.round(mod.passThreshold * 100)}%`}
        description={`You have ${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? "" : "s"} left. The retake covers the same material — review it, then try again.`}
        primaryAction={
          <Button asChild>
            <Link href={`/manager/modules/${mod.slug}/quiz`}>
              Retake quiz now <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: XCircle, label: "Last score", value: fmtPct(state.failedAttempt.scorePct) },
          { icon: RefreshCcw, label: "Attempts left", value: String(state.attemptsRemaining) },
        ]}
      />
    );
  }

  if (state.kind === "locked") {
    return (
      <StatusContainer
        variant={variant}
        accent="rose"
        icon={AlertTriangle}
        eyebrow="Out of attempts"
        title="Talk to your trainer about next steps"
        description={`You've used all ${state.attemptsUsed} attempts without reaching ${Math.round(mod.passThreshold * 100)}%. The platform has flagged you for review — your trainer will reach out.`}
        primaryAction={null}
        meta={[
          { icon: XCircle, label: "Last score", value: fmtPct(state.lastAttempt.scorePct) },
          { icon: AlertTriangle, label: "Attempts used", value: String(state.attemptsUsed) },
        ]}
      />
    );
  }

  if (state.kind === "awaiting-seminar") {
    return (
      <StatusContainer
        variant={variant}
        accent="slate"
        icon={Lock}
        eyebrow="Quiz locked"
        title={`Quiz unlocks after the live seminar on ${fmtDate(state.seminarDate)}${timeStr ? ` at ${timeStr}` : ""}`}
        description="The quiz is delivered on-site immediately after the live seminar. You'll be able to take it once you've attended and checked in to that day's session."
        primaryAction={
          <Button asChild variant="outline">
            <Link href={`/manager/modules/${mod.slug}`}>
              Review materials <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: Calendar, label: "Training day", value: timeStr ? `${fmtDate(state.seminarDate)} · ${timeStr}` : fmtDate(state.seminarDate) },
          { icon: Target, label: "Pass at", value: `${Math.round(mod.passThreshold * 100)}%` },
        ]}
      />
    );
  }

  if (state.kind === "missed-session") {
    return (
      <StatusContainer
        variant={variant}
        accent="amber"
        icon={AlertTriangle}
        eyebrow="You missed this session"
        title={`The ${mod.title} session was on ${fmtDate(state.seminarDate)}`}
        description="You weren't checked in to that day's seminar, so the quiz didn't open for you. Your trainer will reschedule you to the next delivery."
        primaryAction={null}
        meta={[
          { icon: Calendar, label: "Original session", value: fmtDate(state.seminarDate) },
          { icon: RefreshCcw, label: "Status", value: "Awaiting reschedule" },
        ]}
      />
    );
  }

  // state.kind === "ready"
  if (sessionEndedAt) {
    return (
      <StatusContainer
        variant={variant}
        accent="brand"
        icon={Sparkles}
        eyebrow="Quiz is open"
        title={`Ready to take the ${mod.title} quiz`}
        description="The seminar has wrapped up. Take the quiz now — everyone gets the same questions. If you don't pass, a retake is auto-assigned (up to 3 attempts in total)."
        primaryAction={
          <Button asChild size={variant === "full" ? "lg" : "default"} className={variant === "full" ? "h-11" : ""}>
            <Link href={`/manager/modules/${mod.slug}/quiz`}>
              Start {mod.title} Quiz <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: UserCheck, label: "Checked in", value: state.checkedIn ? "Yes" : "Not required" },
          { icon: Target, label: "Pass at", value: `${Math.round(mod.passThreshold * 100)}%` },
          { icon: Clock, label: "Time limit", value: mod.timeLimitMinutes ? `${mod.timeLimitMinutes} min` : "Untimed" },
        ]}
      />
    );
  }

  if (sessionLive) {
    return (
      <StatusContainer
        variant={variant}
        accent="brand"
        icon={Sparkles}
        eyebrow="🔴 Live now"
        title={`${mod.title} seminar is in progress`}
        description="You're checked in. Sit tight, listen to your trainer — the quiz unlocks the moment they end the session."
        primaryAction={null}
        meta={[
          { icon: UserCheck, label: "Checked in", value: "Yes" },
          { icon: Sparkles, label: "Status", value: "Seminar live" },
          { icon: Target, label: "Pass at", value: `${Math.round(mod.passThreshold * 100)}%` },
        ]}
      />
    );
  }

  return (
    <StatusContainer
      variant={variant}
      accent="slate"
      icon={Lock}
      eyebrow="Checked in — waiting for trainer"
      title={`You're early — ${mod.title} hasn't started yet`}
      description="Your trainer will start the session shortly. The quiz will open once they end the live seminar."
      primaryAction={
        <Button asChild variant="outline">
          <Link href={`/manager/modules/${mod.slug}`}>
            Review materials <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      }
      meta={[
        { icon: UserCheck, label: "Checked in", value: "Yes" },
        { icon: Calendar, label: "Training day", value: mod.scheduledDate ? (timeStr ? `${fmtDate(mod.scheduledDate)} · ${timeStr}` : fmtDate(mod.scheduledDate)) : "—" },
      ]}
    />
  );
}

interface StatusContainerProps {
  variant: "compact" | "full";
  accent: "emerald" | "amber" | "rose" | "slate" | "brand";
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: React.ReactNode | null;
  meta: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[];
}

const ACCENT_CLASSES: Record<StatusContainerProps["accent"], { stripe: string; border: string; iconBg: string; iconText: string; bg: string }> = {
  emerald: { stripe: "bg-emerald-500", border: "border-emerald-500/40", iconBg: "bg-emerald-100 dark:bg-emerald-950/40", iconText: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-950/15" },
  amber:   { stripe: "bg-amber-500",   border: "border-amber-500/40",   iconBg: "bg-amber-100 dark:bg-amber-950/40",     iconText: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50/50 dark:bg-amber-950/15" },
  rose:    { stripe: "bg-rose-500",    border: "border-rose-500/40",    iconBg: "bg-rose-100 dark:bg-rose-950/40",       iconText: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50/50 dark:bg-rose-950/15" },
  slate:   { stripe: "bg-slate-400",   border: "border-slate-400/40",   iconBg: "bg-slate-100 dark:bg-slate-800/40",     iconText: "text-slate-600 dark:text-slate-400",     bg: "bg-slate-50/50 dark:bg-slate-900/30" },
  brand:   { stripe: "bg-primary",     border: "border-primary/40",     iconBg: "bg-primary/10",                          iconText: "text-primary",                            bg: "bg-primary/[0.03]" },
};

function StatusContainer({
  variant, accent, icon: Icon, eyebrow, title, description, primaryAction, meta,
}: StatusContainerProps) {
  const c = ACCENT_CLASSES[accent];

  if (variant === "compact") {
    return (
      <Card className={cn("relative overflow-hidden", c.border)}>
        <div className={cn("absolute inset-x-0 top-0 h-1", c.stripe)} />
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0", c.iconBg, c.iconText)}>
            <Icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{eyebrow}</div>
            <div className="text-sm font-semibold truncate mt-0.5">{title}</div>
          </div>
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden", c.border, c.bg)}>
      <div className={cn("absolute inset-x-0 top-0 h-1", c.stripe)} />
      <CardContent className="p-6 md:p-7">
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-5 items-center">
          <div className={cn("size-14 rounded-xl flex items-center justify-center shrink-0", c.iconBg, c.iconText)}>
            <Icon className="size-7" />
          </div>
          <div className="min-w-0">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-2">
              {eyebrow}
            </Badge>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{title}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>
          </div>
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {meta.length > 0 && (
          <div className="mt-5 pt-5 border-t flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {meta.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <m.icon className="size-3.5" />
                <span>{m.label}:</span>
                <span className="font-semibold text-foreground">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
