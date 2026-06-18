"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Check, X, AlertCircle, Sparkles, Target, Clock, Layers, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import type { ModuleDef, QuestionPool } from "@/types";
import { ConfettiBurst, CountUp, DrawCheck, motion, AnimatePresence } from "@/components/shared/animations";
import {
  startQuiz,
  submitQuiz,
  type QuizQuestion,
} from "@/lib/server/quiz-actions";
import { useT } from "@/lib/i18n/provider";

type Phase = "intro" | "in-progress" | "submitted";

interface RenderQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; correct?: boolean }[];
}

export function ManagerQuizView({ mod }: { mod: ModuleDef }) {
  const router = useRouter();
  const t = useT();
  const slug = mod.slug;

  const [phase, setPhase] = React.useState<Phase>("intro");
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = React.useState((mod.timeLimitMinutes ?? 30) * 60);
  const [result, setResult] = React.useState<{ score: number; correct: number; total: number; passed: boolean; locked: boolean; attemptsRemaining: number } | null>(null);

  const [serverQuestions, setServerQuestions] = React.useState<QuizQuestion[] | null>(null);
  const [serverPool, setServerPool] = React.useState<QuestionPool | null>(null);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);

  const activePool: QuestionPool = serverPool ?? "first-attempt";
  const allQuestions: RenderQuestion[] = serverQuestions ?? [];

  React.useEffect(() => {
    if (phase !== "in-progress") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  React.useEffect(() => {
    if (phase === "in-progress" && secondsLeft === 0) submit();
  }, [secondsLeft, phase]); // eslint-disable-line

  async function start() {
    setStartError(null);

    setStarting(true);
    const res = await startQuiz(slug);
    setStarting(false);

    if (!res.ok) {
      setStartError(res.error);
      toast.error(res.error);
      return;
    }

    setAttemptId(res.attemptId);
    setServerQuestions(res.questions);
    setServerPool(res.pool);
    setSecondsLeft((res.timeLimitMinutes ?? mod.timeLimitMinutes ?? 30) * 60);
    setIdx(0);
    setAnswers({});
    setPhase("in-progress");
  }

  async function submit() {
    if (!attemptId) {
      toast.error(t("quiz.toastLostSession"));
      return;
    }

    setSubmitting(true);
    const payload = allQuestions.map((q) => ({
      question_id: q.id,
      selected_option_id: answers[q.id] ?? null,
    }));
    const res = await submitQuiz(attemptId, payload);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    finishWithResult({
      score: Math.round(res.scorePct),
      correct: res.correctCount,
      total: res.totalCount,
      passed: res.passed,
      locked: res.locked,
      attemptsRemaining: res.attemptsRemaining,
    });
  }

  function finishWithResult(r: { score: number; correct: number; total: number; passed: boolean; locked: boolean; attemptsRemaining: number }) {
    setResult(r);
    setPhase("submitted");
    toast(
      r.passed
        ? t("quiz.toastPassed", { score: r.score })
        : r.locked
          ? t("quiz.toastNoAttempts", { score: r.score })
          : t("quiz.toastRetakeScheduled", { score: r.score }),
      {
        description: r.passed
          ? t("quiz.toastUnlockNext", { n: mod.number + 1 })
          : r.locked
            ? t("quiz.toastLockedDesc")
            : t("quiz.toastRetakeDesc", { n: r.attemptsRemaining, attempts: r.attemptsRemaining === 1 ? t("quiz.attempt") : t("quiz.attempts") }),
      },
    );
  }

  if (phase === "intro") {
    const introQuestionCount = mod.questionCount;
    return (
      <>
        <PageHeader
          eyebrow={t("quiz.eyebrow", { n: mod.number })}
          title={t("quiz.title", { module: mod.title })}
          description={t("quiz.intro")}
        />
        <div className="max-w-2xl">
          <Card>
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-semibold tracking-tight">{mod.title}</h2>
              <p className="text-muted-foreground mt-1">{t("quiz.readEach")}</p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Stat icon={Layers} label={t("quiz.questions")} value={`${introQuestionCount}`} />
                <Stat icon={Target} label={t("quiz.passAt")} value={`${Math.round(mod.passThreshold * 100)}%`} />
                <Stat icon={Clock} label={t("quiz.time")} value={`${mod.timeLimitMinutes ?? "—"} min`} />
                <Stat icon={Sparkles} label={t("quiz.format")} value={t("quiz.multipleChoice")} />
              </div>

              {activePool === "retake" && (
                <div className="mt-6 rounded-lg border border-violet-500/40 bg-violet-50/50 dark:bg-violet-950/20 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Sparkles className="size-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-violet-900 dark:text-violet-200">{t("quiz.thisIsRetake")}</div>
                      <div className="text-violet-800/80 dark:text-violet-300/80 mt-0.5">
                        {t("quiz.retakeDesc")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-muted-foreground">
                    {activePool === "first-attempt"
                      ? t("quiz.firstHint")
                      : t("quiz.retakeHint")}
                  </div>
                </div>
              </div>

              {startError && (
                <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-sm text-rose-700 dark:text-rose-300">
                  {startError}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <Button onClick={start} size="lg" className="h-12" disabled={starting}>
                  {starting ? (
                    <><Loader2 className="size-4 animate-spin mr-1" /> {t("quiz.preparing")}</>
                  ) : (
                    <>{t("quiz.start", { n: mod.number })} <ArrowRight className="ml-1 size-4" /></>
                  )}
                </Button>
                <Button variant="outline" size="lg" className="h-12" onClick={() => router.push(`/manager/modules/${slug}`)}>
                  {t("quiz.reviewFirst")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (phase === "in-progress") {
    const q = allQuestions[idx];
    if (!q) return null;
    const selected = answers[q.id];
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    const timeWarn = secondsLeft < 60;
    return (
      <>
        <div className="sticky top-14 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur border-b z-30 flex items-center justify-between">
          <div className="text-sm font-medium">
            {t("quiz.questionOf", { i: idx + 1, n: allQuestions.length })}
          </div>
          <div className="flex-1 mx-4 md:mx-8 max-w-md h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${((idx + 1) / allQuestions.length) * 100}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-mono tabular-nums ${timeWarn ? "text-rose-500" : "text-muted-foreground"}`}>
            <Clock className="size-3.5" />
            {m}:{s.toString().padStart(2, "0")}
          </div>
        </div>

        <div className="max-w-3xl mx-auto pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardContent className="p-6 md:p-10">
                  <Badge variant="outline" className="mb-5">{mod.title}</Badge>
                  <h2 className="text-2xl font-semibold leading-snug tracking-tight">{q.text}</h2>

                  <div className="mt-8 space-y-2.5">
                    {q.options.map((o, oi) => {
                      const isSelected = selected === o.id;
                      return (
                        <motion.button
                          key={o.id}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 + oi * 0.05, duration: 0.3 }}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          className={`w-full text-left px-5 py-4 rounded-lg border-2 transition-colors flex items-center gap-3
                            ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-accent/50"}
                          `}
                        >
                          <div className={`size-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
                            ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}
                          `}>
                            {isSelected && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}>
                                <Check className="size-3.5" />
                              </motion.span>
                            )}
                          </div>
                          <span className="font-medium">{o.text}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
            >
              <ArrowLeft className="size-4 mr-1" /> {t("quiz.previous")}
            </Button>
            <div className="text-xs text-muted-foreground">
              {t("quiz.answered", { n: Object.keys(answers).length })}
            </div>
            {idx < allQuestions.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)} disabled={!selected}>
                {t("quiz.next")} <ArrowRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={submitting || Object.keys(answers).length < allQuestions.length / 2}
              >
                {submitting ? (
                  <><Loader2 className="size-4 animate-spin mr-1" /> {t("quiz.submitting")}</>
                ) : (
                  t("quiz.submit")
                )}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ConfettiBurst active={!!result?.passed} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <Card className={`overflow-hidden ${result?.passed ? "border-emerald-500/40" : "border-amber-500/40"}`}>
        <motion.div
          className={`h-2 ${result?.passed ? "bg-emerald-500" : "bg-amber-500"}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: 0 }}
        />
        <CardContent className="p-8 md:p-12 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.1 }}
            className={`size-20 rounded-full mx-auto flex items-center justify-center mb-6
              ${result?.passed ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-amber-100 dark:bg-amber-950/40"}
            `}
          >
            {result?.passed ? (
              <DrawCheck size={48} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X className="size-10 text-amber-600 dark:text-amber-400" />
            )}
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">
            {result?.passed ? t("quiz.passedTitle") : t("quiz.failedTitle")}
          </h1>
          <div className="mt-2 text-muted-foreground">
            {t("quiz.youScored")}{" "}
            <span className="font-semibold text-foreground">
              <CountUp value={result?.score ?? 0} suffix="%" durationMs={1200} />
            </span>{" "}
            {t("quiz.on", { module: mod.title })}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto">
            <motion.div className="rounded-lg border p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="text-xs text-muted-foreground">{t("quiz.score")}</div>
              <div className="text-2xl font-bold tabular-nums mt-0.5">
                <CountUp value={result?.score ?? 0} suffix="%" durationMs={1400} />
              </div>
            </motion.div>
            <motion.div className="rounded-lg border p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="text-xs text-muted-foreground">{t("quiz.correct")}</div>
              <div className="text-2xl font-bold tabular-nums mt-0.5">
                <CountUp value={result?.correct ?? 0} durationMs={1100} /> / {result?.total}
              </div>
            </motion.div>
            <motion.div className="rounded-lg border p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="text-xs text-muted-foreground">{t("quiz.passAtShort")}</div>
              <div className="text-2xl font-bold tabular-nums mt-0.5">{Math.round(mod.passThreshold * 100)}%</div>
            </motion.div>
          </div>

          <div className="mt-8 text-sm text-muted-foreground max-w-md mx-auto">
            {result?.passed
              ? t("quiz.unlocksNext", { n: mod.number + 1 })
              : result?.locked
                ? t("quiz.lockedMsg")
                : t("quiz.retakeScheduled", {
                    n: result?.attemptsRemaining ?? 0,
                    attempts: result?.attemptsRemaining === 1 ? t("quiz.attempt") : t("quiz.attempts"),
                  })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/manager/dashboard">{t("quiz.backToDashboard")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/manager/attempts/${attemptId}`}>{t("quiz.reviewMyAnswers")}</Link>
            </Button>
            {result?.passed && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/manager/modules/${slug}/certificate`}>{t("quiz.viewCertificate")}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4 flex items-center gap-3">
      <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}
