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
import { fmtDate, fmtRelative, fmtPct, fmtTimeWithZone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModuleDef, Attempt } from "@/types";
import { useT } from "@/lib/i18n/provider";

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
  const t = useT();
  const sessionLive = !!sessionStartedAt && !sessionEndedAt;
  const timeStr = fmtTimeWithZone(mod.scheduledTime, mod.timezone);

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
        eyebrow={t("status.notInvitedEyebrow")}
        title={t("status.notInvitedTitle", { module: mod.title })}
        description={t("status.notInvitedDesc")}
        primaryAction={null}
        meta={[
          { icon: Calendar, label: t("status.metaNextDelivery"), value: mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—" },
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
        eyebrow={t("status.passedEyebrow")}
        title={t("status.passedTitle", { score: fmtPct(state.passedAttempt.scorePct), module: mod.title })}
        description={t("status.passedDesc")}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/manager/attempts/${state.passedAttempt.id}`}>{t("quiz.reviewMyAnswers")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/manager/modules/${mod.slug}/certificate`}>
                <Award className="size-4 mr-1.5" /> {t("status.viewCertificate")}
              </Link>
            </Button>
          </div>
        }
        meta={[
          { icon: CheckCircle2, label: t("status.metaPassedOn"), value: fmtDate(state.passedAttempt.submittedAt ?? state.passedAttempt.startedAt) },
          { icon: Calendar, label: t("status.metaRefresher"), value: fmtDate(state.refresherDueDate) },
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
        eyebrow={t("status.retakeEyebrow")}
        title={t("status.retakeTitle", { score: fmtPct(state.failedAttempt.scorePct), threshold: Math.round(mod.passThreshold * 100) })}
        description={t("status.retakeDesc", { n: state.attemptsRemaining })}
        primaryAction={
          <Button asChild>
            <Link href={`/manager/modules/${mod.slug}/quiz`}>
              {t("status.retakeNow")} <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: XCircle, label: t("status.metaLastScore"), value: fmtPct(state.failedAttempt.scorePct) },
          { icon: RefreshCcw, label: t("status.metaAttemptsLeft"), value: String(state.attemptsRemaining) },
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
        eyebrow={t("status.lockedEyebrow")}
        title={t("status.lockedTitle")}
        description={t("status.lockedDesc", { n: state.attemptsUsed, threshold: Math.round(mod.passThreshold * 100) })}
        primaryAction={null}
        meta={[
          { icon: XCircle, label: t("status.metaLastScore"), value: fmtPct(state.lastAttempt.scorePct) },
          { icon: AlertTriangle, label: t("status.metaAttemptsUsed"), value: String(state.attemptsUsed) },
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
        eyebrow={t("status.awaitingEyebrow")}
        title={t("status.awaitingTitle", { date: fmtDate(state.seminarDate) }) + (timeStr ? t("status.awaitingTimeSuffix", { time: timeStr }) : "")}
        description={t("status.awaitingDesc")}
        primaryAction={
          // On the module page (full) the materials are right below, so the
          // button would just confuse — only show it on the compact dashboard
          // card, where it navigates to the module.
          variant === "compact" ? (
            <Button asChild variant="outline">
              <Link href={`/manager/modules/${mod.slug}#seminar-outline`}>
                {t("status.reviewMaterials")} <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          ) : null
        }
        meta={[
          { icon: Calendar, label: t("status.metaTrainingDay"), value: timeStr ? `${fmtDate(state.seminarDate)} · ${timeStr}` : fmtDate(state.seminarDate) },
          { icon: Target, label: t("status.metaPassAt"), value: `${Math.round(mod.passThreshold * 100)}%` },
        ]}
      />
    );
  }

  if (state.kind === "missed-session") {
    // The live seminar passed without a check-in. Rather than dead-ending, let
    // the manager take the quiz on their own time — admins still see this
    // attempt as "not attended" (no attendance row was created).
    return (
      <StatusContainer
        variant={variant}
        accent="amber"
        icon={AlertTriangle}
        eyebrow={t("status.missedEyebrow")}
        title={t("status.missedTitle", { module: mod.title, date: fmtDate(state.seminarDate) })}
        description={t("status.missedDesc")}
        primaryAction={
          <Button asChild>
            <Link href={`/manager/modules/${mod.slug}/quiz`}>
              {t("status.missedTakeQuiz")} <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: Calendar, label: t("status.metaOriginalSession"), value: fmtDate(state.seminarDate) },
          { icon: Target, label: t("status.metaPassAt"), value: `${Math.round(mod.passThreshold * 100)}%` },
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
        eyebrow={t("status.readyEyebrow")}
        title={t("status.readyTitle", { module: mod.title })}
        description={t("status.readyDesc")}
        primaryAction={
          <Button asChild size={variant === "full" ? "lg" : "default"} className={variant === "full" ? "h-11" : ""}>
            <Link href={`/manager/modules/${mod.slug}/quiz`}>
              {t("status.startQuiz", { module: mod.title })} <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        }
        meta={[
          { icon: UserCheck, label: t("status.metaCheckedIn"), value: state.checkedIn ? t("status.metaYes") : t("status.metaNotRequired") },
          { icon: Target, label: t("status.metaPassAt"), value: `${Math.round(mod.passThreshold * 100)}%` },
          { icon: Clock, label: t("status.metaTimeLimit"), value: mod.timeLimitMinutes ? `${mod.timeLimitMinutes} min` : "Untimed" },
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
        eyebrow={t("status.liveEyebrow")}
        title={t("status.liveTitle", { module: mod.title })}
        description={t("status.liveDesc")}
        primaryAction={null}
        meta={[
          { icon: UserCheck, label: t("status.metaCheckedIn"), value: t("status.metaYes") },
          { icon: Sparkles, label: t("status.metaStatus"), value: t("status.metaSeminarLive") },
          { icon: Target, label: t("status.metaPassAt"), value: `${Math.round(mod.passThreshold * 100)}%` },
        ]}
      />
    );
  }

  return (
    <StatusContainer
      variant={variant}
      accent="slate"
      icon={Lock}
      eyebrow={t("status.earlyEyebrow")}
      title={t("status.earlyTitle", { module: mod.title })}
      description={t("status.earlyDesc")}
      primaryAction={
        variant === "compact" ? (
          <Button asChild variant="outline">
            <Link href={`/manager/modules/${mod.slug}#seminar-outline`}>
              {t("status.reviewMaterials")} <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        ) : null
      }
      meta={[
        { icon: UserCheck, label: t("status.metaCheckedIn"), value: t("status.metaYes") },
        { icon: Calendar, label: t("status.metaTrainingDay"), value: mod.scheduledDate ? (timeStr ? `${fmtDate(mod.scheduledDate)} · ${timeStr}` : fmtDate(mod.scheduledDate)) : "—" },
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
