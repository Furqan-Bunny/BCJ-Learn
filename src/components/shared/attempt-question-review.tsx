"use client";

// Read-only "question-by-question" view of a single quiz attempt: the actual
// question text, every option, the option the learner picked, and the correct
// option. Same UI for the admin viewing an employee's attempt and for the
// employee reviewing their own — only the "answer" label differs.

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attempt, Question } from "@/types";

export interface ReviewedQuestion {
  question: Question;
  selectedOpt?: { id: string; text: string; correct: boolean };
  correctOpt?: { id: string; text: string; correct: boolean };
  correct: boolean;
}

/** Build the per-question rows from an attempt + the module's question bank. */
export function buildReviewedQuestions(attempt: Attempt, questions: Question[]): ReviewedQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return attempt.answers
    .map((ans): ReviewedQuestion | null => {
      const q = byId.get(ans.questionId);
      if (!q) return null;
      return {
        question: q,
        selectedOpt: q.options.find((o) => o.id === ans.selectedOptionId),
        correctOpt: q.options.find((o) => o.correct),
        correct: ans.correct,
      };
    })
    .filter((x): x is ReviewedQuestion => !!x);
}

export interface AttemptQuestionReviewProps {
  reviewed: ReviewedQuestion[];
  /** Full badge label for the picked option — e.g. "Your answer" (employee
   *  reviewing themselves) or "Estevan's answer" (admin reviewing). */
  answerBadge: string;
  /** Subtitle under the card title. Optional. */
  subtitle?: string;
}

export function AttemptQuestionReview({ reviewed, answerBadge, subtitle }: AttemptQuestionReviewProps) {
  const correctCount = reviewed.filter((a) => a.correct).length;
  const wrongCount = reviewed.length - correctCount;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Question-by-question breakdown</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
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
          {reviewed.map((aq, idx) => (
            <li key={aq.question.id} className="px-5 md:px-6 py-5">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                  aq.correct ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                             : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
                )}>
                  {aq.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 mt-0.5">
                      Q{String(idx + 1).padStart(2, "0")}
                    </span>
                    <Sparkles className="size-3 text-[var(--ai)] shrink-0 mt-0.5" />
                    <div className="font-medium leading-snug">{aq.question.text}</div>
                  </div>

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
                              {answerBadge}
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
  );
}
