"use client";

// Employee-side read-only review of one of their own quiz attempts:
// score header + question-by-question breakdown (shared with the admin view).

import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Target, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AttemptQuestionReview, buildReviewedQuestions } from "@/components/shared/attempt-question-review";
import { fmtDate, fmtPct } from "@/lib/format";
import type { Attempt, Question } from "@/types";

function fmtDuration(sec?: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface Props {
  attempt: Attempt;
  moduleTitle: string;
  moduleNumber: number | null;
  passThreshold: number;
  firstName: string;
  questions: Question[];
}

export function ManagerAttemptView({ attempt, moduleTitle, moduleNumber, passThreshold, firstName, questions }: Props) {
  const reviewed = buildReviewedQuestions(attempt, questions);
  const passed = attempt.status === "passed";
  const correctCount = reviewed.filter((a) => a.correct).length;
  const wrongCount = reviewed.length - correctCount;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/manager/progress"><ArrowLeft className="size-4 mr-1" /> My Progress</Link>
      </Button>

      <PageHeader
        eyebrow={`Attempt · ${fmtDate(attempt.startedAt, "MMM d, yyyy 'at' h:mm a")}`}
        title={`${moduleNumber ? `M${moduleNumber}: ` : ""}${moduleTitle}`}
        description={attempt.pool === "retake" ? "Retake attempt." : "First attempt."}
        actions={<StatusBadge variant={attempt.status as "passed" | "failed"} />}
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className={`size-16 rounded-xl flex items-center justify-center shrink-0 ${
              passed ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                     : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"}`}>
              {passed ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-bold tabular-nums">{fmtPct(attempt.scorePct)}</div>
              <div className="text-sm text-muted-foreground">
                {passed ? "You passed" : `Needed ${Math.round(passThreshold * 100)}% to pass`}
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> <span className="tabular-nums font-semibold">{correctCount}</span> correct</div>
              <div className="flex items-center gap-2"><XCircle className="size-4 text-rose-500" /> <span className="tabular-nums font-semibold">{wrongCount}</span> wrong</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" /> {fmtDuration(attempt.durationSec)}</div>
              <Badge variant="outline" className="text-[10px]"><Target className="size-3 mr-1" /> Pass at {Math.round(passThreshold * 100)}%</Badge>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            Submitted {fmtDate(attempt.submittedAt ?? attempt.startedAt, "MMM d, yyyy 'at' h:mm a")}
          </div>
        </CardContent>
      </Card>

      <AttemptQuestionReview
        reviewed={reviewed}
        answerBadge="Your answer"
        hideCorrect={!passed}
        collapsible
        subtitle={
          passed
            ? "Every question you saw — tap any one to see your answer and the correct answer."
            : "Every question you saw — tap any one to see your answer. On the ones you missed, the correct answer is hidden so you can relearn it, then retake."
        }
      />
    </>
  );
}
