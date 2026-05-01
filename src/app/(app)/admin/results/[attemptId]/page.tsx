"use client";

import * as React from "react";
import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { attempts } from "@/data/attempts";
import { managers } from "@/data/users";
import { modules } from "@/data/modules";
import { questions } from "@/data/questions";
import { moduleDeliveries } from "@/data/queries";
import { useAttendanceStore } from "@/store/attendance-store";
import { initials, fmtDate, fmtPct, fmtDuration, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AttemptDetailPage(props: PageProps<"/admin/results/[attemptId]">) {
  const { attemptId } = use(props.params);
  const attempt = attempts.find((a) => a.id === attemptId);
  if (!attempt) return notFound();

  const m = managers.find((x) => x.id === attempt.managerId);
  const mod = modules.find((x) => x.slug === attempt.moduleSlug);
  if (!m || !mod) return notFound();

  // Find which delivery this attempt belongs to
  const deliveryHistoryMap = useAttendanceStore((s) => s.deliveryHistory);
  const deliveryStartMap = useAttendanceStore((s) => s.deliveryStartDate);
  const deliveries = moduleDeliveries(
    attempt.moduleSlug,
    deliveryHistoryMap[attempt.moduleSlug] ?? [],
    deliveryStartMap[attempt.moduleSlug],
  );
  const ts = new Date(attempt.startedAt).getTime();
  const matchingDelivery = deliveries.find((d) => {
    const startMs = d.index === 1 ? -Infinity : new Date(d.startDate).getTime();
    const endMs = d.endDate ? new Date(d.endDate).getTime() : Infinity;
    return ts >= startMs && ts < endMs;
  });

  // Build full Q&A view: each answer + its question
  const answeredQuestions = attempt.answers
    .map((ans) => {
      const q = questions.find((qq) => qq.id === ans.questionId);
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
        eyebrow={`Attempt · ${fmtDate(attempt.startedAt, "MMM d, yyyy 'at' h:mm a")}${matchingDelivery ? ` · Delivery ${matchingDelivery.index}${matchingDelivery.isCurrent ? " (current)" : " (archived)"}` : ""}`}
        title={`${m.name} · ${mod.title}`}
        description={`Module ${mod.number} ${attempt.pool === "retake" ? "retake (easier pool)" : "first attempt"}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => toast.success(`Reminder sent to ${m.name}`)}>
              <Bell className="mr-2 size-4" /> Send reminder
            </Button>
            {!passed && (
              <Button variant="outline" onClick={() => toast(`Retake scheduled for ${m.name}`)}>
                <RefreshCcw className="mr-2 size-4" /> Schedule retake
              </Button>
            )}
          </div>
        }
      />

      {/* Hero result card */}
      <Card className={cn("overflow-hidden mb-6", passed ? "border-emerald-500/40" : "border-amber-500/40")}>
        <div className={cn("h-1.5", passed ? "bg-emerald-500" : "bg-amber-500")} />
        <CardContent className="p-6 md:p-8">
          <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            {/* Status icon */}
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

            {/* Score */}
            <div className="text-center md:text-left">
              <div className="text-5xl font-bold tracking-tight tabular-nums">
                {fmtPct(attempt.scorePct)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {passed ? `Passed — needed ${Math.round(mod.passThreshold * 100)}%` : `Did not reach ${Math.round(mod.passThreshold * 100)}% threshold`}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <StatusBadge variant={passed ? "passed" : "failed"} />
                <StatusBadge variant={attempt.pool} />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 max-w-sm">
              <Stat icon={Trophy} label="Correct" value={`${correctCount}/${attempt.totalCount}`} tone="success" />
              <Stat icon={XCircle} label="Wrong" value={String(wrongCount)} tone={wrongCount > 0 ? "warn" : "muted"} />
              <Stat icon={Clock} label="Time" value={fmtDuration(attempt.durationSec)} />
              <Stat icon={Target} label="Threshold" value={`${Math.round(mod.passThreshold * 100)}%`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manager + module info row */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Avatar className="size-12 border">
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

      {/* Question-by-question breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Question-by-question breakdown</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              The exact questions {m.name.split(" ")[0]} saw and how they answered each one.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">{correctCount} correct</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">{wrongCount} wrong</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {answeredQuestions.map((aq, idx) => (
              <li key={aq.question.id} className="px-5 md:px-6 py-5">
                <div className="flex items-start gap-4">
                  {/* Pass/fail icon */}
                  <div className={cn(
                    "size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                    aq.correct ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                               : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
                  )}>
                    {aq.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Question header */}
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 mt-0.5">
                        Q{String(idx + 1).padStart(2, "0")}
                      </span>
                      <Sparkles className="size-3 text-[var(--ai)] shrink-0 mt-0.5" />
                      <div className="font-medium leading-snug">{aq.question.text}</div>
                    </div>

                    {/* Options with selection state */}
                    <div className="space-y-1.5 ml-6">
                      {aq.question.options.map((o) => {
                        const isSelected = aq.selectedOpt?.id === o.id;
                        const isCorrect = o.correct;
                        return (
                          <div
                            key={o.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md border text-sm",
                              isCorrect && "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
                              isSelected && !isCorrect && "border-rose-500/40 bg-rose-50 dark:bg-rose-950/20",
                              !isSelected && !isCorrect && "border-border",
                            )}
                          >
                            <div className={cn(
                              "size-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                              isCorrect ? "border-emerald-500 bg-emerald-500" :
                              isSelected ? "border-rose-500 bg-rose-500" :
                              "border-muted-foreground/30",
                            )}>
                              {(isCorrect || (isSelected && !isCorrect)) && (
                                <span className="size-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <span className={cn(
                              "flex-1",
                              isCorrect && "font-medium text-emerald-900 dark:text-emerald-200",
                              isSelected && !isCorrect && "font-medium text-rose-900 dark:text-rose-200 line-through",
                            )}>
                              {o.text}
                            </span>
                            {isSelected && (
                              <Badge variant="outline" className={cn(
                                "text-[10px] shrink-0",
                                isCorrect ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
                                            "border-rose-500/40 text-rose-700 dark:text-rose-300",
                              )}>
                                {m.name.split(" ")[0]}&apos;s answer
                              </Badge>
                            )}
                            {isCorrect && !isSelected && (
                              <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                                Correct answer
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {aq.question.explanation && (
                      <div className="ml-6 mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Why: </span>
                        {aq.question.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
            <Button variant="outline" onClick={() => toast(`Override panel (mocked)`)}>
              Override
            </Button>
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
