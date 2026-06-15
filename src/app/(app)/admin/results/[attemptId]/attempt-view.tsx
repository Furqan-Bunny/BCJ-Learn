"use client";

import Link from "next/link";
import { AttemptQuestionReview } from "@/components/shared/attempt-question-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Target,
  Trophy,
  Sparkles,
  ArrowUpRight,
  Bell,
  RefreshCcw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { initials, fmtDate, fmtPct, fmtDuration, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import * as React from "react";
import { sendReminder } from "@/lib/server/reminder-actions";
import { resetManagerForModule } from "@/lib/server/module-actions";
import type { Attempt, Manager, ModuleDef, Question } from "@/types";
import type { DeliveryRecord } from "@/lib/db/deliveries";

export interface AttemptDetailViewProps {
  attempt: Attempt;
  m: Manager;
  mod: ModuleDef;
  questions: Question[];
  deliveries: DeliveryRecord[];
}

export function AttemptDetailView({ attempt, m, mod, questions, deliveries }: AttemptDetailViewProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const ts = new Date(attempt.startedAt).getTime();
  const matchingDelivery = deliveries.find((d) => {
    const startMs = d.index === 1 ? -Infinity : new Date(d.startDate).getTime();
    const endMs = d.endDate ? new Date(d.endDate).getTime() : Infinity;
    return ts >= startMs && ts < endMs;
  });
  // Was this attempt taken during the live seminar (between session_started_at
  // and session_ended_at) vs async/outside the live session?
  const wasLive = deliveries.some((d) => {
    if (!d.sessionStartedAt) return false;
    const start = new Date(d.sessionStartedAt).getTime();
    const end = d.sessionEndedAt ? new Date(d.sessionEndedAt).getTime() : Infinity;
    return ts >= start && ts <= end;
  });

  async function handleSendReminder() {
    setBusy(true);
    const res = await sendReminder(m.id, mod.slug);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not send"); return; }
    toast.success(`Reminder sent to ${m.name}`);
    router.refresh();
  }

  async function handleScheduleRetake() {
    setBusy(true);
    const res = await resetManagerForModule(m.id, mod.slug);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not schedule retake"); return; }
    toast.success(`Retake scheduled for ${m.name}`);
    router.refresh();
  }

  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const answeredQuestions = attempt.answers
    .map((ans) => {
      const q = questionsById.get(ans.questionId);
      if (!q) return null;
      const correctOpt = q.options.find((o) => o.correct);
      const selectedOpt = q.options.find((o) => o.id === ans.selectedOptionId);
      return { question: q, selectedOpt, correctOpt, correct: ans.correct };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const correctCount = answeredQuestions.filter((a) => a.correct).length;
  const wrongCount = answeredQuestions.length - correctCount;
  const passed = attempt.status === "passed";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/results"><ArrowLeft className="size-4 mr-1" /> All results</Link>
      </Button>

      <PageHeader
        eyebrow={`Attempt · ${fmtDate(attempt.startedAt, "MMM d, yyyy 'at' h:mm a")}${matchingDelivery ? ` · Delivery ${matchingDelivery.index}${matchingDelivery.isCurrent ? " (current)" : " (archived)"}` : ""} · ${wasLive ? "Live session" : "Async"}`}
        title={`${m.name} · ${mod.title}`}
        description={`Module ${mod.number} ${attempt.pool === "retake" ? "retake (easier pool)" : "first attempt"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSendReminder} disabled={busy}>
              <Bell className="mr-2 size-4" /> Send reminder
            </Button>
            {!passed && (
              <Button variant="outline" onClick={handleScheduleRetake} disabled={busy}>
                <RefreshCcw className="mr-2 size-4" /> Schedule retake
              </Button>
            )}
          </div>
        }
      />

      <Card className={cn("overflow-hidden mb-6", passed ? "border-emerald-500/40" : "border-amber-500/40")}>
        <div className={cn("h-1.5", passed ? "bg-emerald-500" : "bg-amber-500")} />
        <CardContent className="p-6 md:p-8">
          <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <div className={cn(
              "size-20 rounded-full flex items-center justify-center shrink-0 mx-auto md:mx-0",
              passed ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-amber-100 dark:bg-amber-950/40",
            )}>
              {passed ? (
                <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="size-10 text-amber-600 dark:text-amber-400" />
              )}
            </div>

            <div className="text-center md:text-left">
              <div className="text-5xl font-bold tracking-tight tabular-nums">{fmtPct(attempt.scorePct)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {passed ? `Passed — needed ${Math.round(mod.passThreshold * 100)}%` : `Did not reach ${Math.round(mod.passThreshold * 100)}% threshold`}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <StatusBadge variant={passed ? "passed" : "failed"} />
                <StatusBadge variant={attempt.pool} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-3 max-w-sm">
              <Stat icon={Trophy} label="Correct" value={`${correctCount}/${attempt.totalCount}`} tone="success" />
              <Stat icon={XCircle} label="Wrong" value={String(wrongCount)} tone={wrongCount > 0 ? "warn" : "muted"} />
              <Stat icon={Clock} label="Time" value={fmtDuration(attempt.durationSec)} />
              <Stat icon={Target} label="Threshold" value={`${Math.round(mod.passThreshold * 100)}%`} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Avatar className="size-12 border">
              <AvatarImage src={m.avatarUrl ?? undefined} alt={m.name} className="object-cover" />
              <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="font-semibold">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Manager</div>
              <div className="font-semibold truncate">{m.name}</div>
              <div className="text-xs text-muted-foreground truncate">{m.email} · {m.cohort}</div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/managers/${m.id}`}>
                Profile <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="size-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              M{mod.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Module</div>
              <div className="font-semibold truncate">{mod.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Calendar className="size-3" /> {mod.scheduledMonth} · taken {fmtRelative(attempt.startedAt)}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/modules/${mod.slug}`}>
                Module <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <AttemptQuestionReview
        reviewed={answeredQuestions.map((aq) => ({
          question: aq.question,
          selectedOpt: aq.selectedOpt,
          correctOpt: aq.correctOpt,
          correct: aq.correct,
        }))}
        answerBadge={`${m.name.split(" ")[0]}'s answer`}
        subtitle={`The exact questions ${m.name.split(" ")[0]} saw and how they answered each one.`}
      />

      {!passed && (
        <Card className="mt-6 border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/15">
          <CardContent className="p-5 flex items-start gap-3">
            <RefreshCcw className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Retake automatically scheduled</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Because {m.name.split(" ")[0]} didn&rsquo;t pass, BCJ Learn has scheduled a retake using the easier question pool. They&rsquo;ll receive an email with the new date.
              </p>
            </div>
            {/* Override flow deferred to v1.1 — admin still has Reassign/Send reminder. */}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "success" | "warn" | "muted";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn"    ? "text-rose-600 dark:text-rose-400" :
    tone === "muted"   ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-md border bg-card p-2.5 flex items-center gap-2">
      <Icon className={cn("size-3.5 shrink-0", toneClass)} />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn("text-sm font-semibold tabular-nums truncate", toneClass)}>{value}</div>
      </div>
    </div>
  );
}
