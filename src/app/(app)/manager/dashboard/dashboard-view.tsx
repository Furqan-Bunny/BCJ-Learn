"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, BookOpen, CheckCircle2, Sparkles, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckInCard } from "@/components/manager/check-in-card";
import { QuizStatusCard } from "@/components/manager/quiz-status-card";
import { DeliveryLiveSync } from "@/components/manager/delivery-live-sync";
import { fmtRelative, initials } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";
import { Stagger, StaggerItem, CountUp, motion, useReducedMotion } from "@/components/shared/animations";
import type { ModuleDef, Attempt, ActivityEvent, ManagerStatus, Cohort } from "@/types";

export interface ManagerDashboardProps {
  me: {
    id: string;
    name: string;
    cohort: Cohort | null;
    status: ManagerStatus;
    avatarColor: string;
    modulesCompleted: number;
    averageScore: number;
  };
  modules: ModuleDef[];
  myAttempts: Attempt[];
  myActivity: ActivityEvent[];
  nextModuleCheckIn: { checkedIn: boolean; checkedInAt: string | null };
  nextModuleSession: { sessionStartedAt: string | null; sessionEndedAt: string | null; checkinOpen: boolean };
}

export function ManagerDashboardView({
  me,
  modules,
  myAttempts,
  myActivity,
  nextModuleCheckIn,
  nextModuleSession,
}: ManagerDashboardProps) {
  const passedSlugs = new Set(myAttempts.filter((a) => a.status === "passed").map((a) => a.moduleSlug));
  // A published module is unlocked — full stop. No "pass the previous one
  // first" gating. We only show published modules and order them by their
  // scheduled training day (soonest first; no-date sinks to the end).
  const orderKey = (m: (typeof modules)[number]) =>
    m.scheduledDate ? new Date(m.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
  const orderedModules = modules
    .filter((m) => m.status === "published")
    .sort((a, b) => orderKey(a) - orderKey(b) || a.number - b.number);
  const completedCount = passedSlugs.size;
  // "Up next" = the soonest published module they haven't passed yet (just a
  // highlight — every published module is still openable).
  const nextModule = orderedModules.find((m) => !passedSlugs.has(m.slug)) ?? orderedModules[orderedModules.length - 1];
  const daysToNext = nextModule?.scheduledDate
    ? differenceInCalendarDays(new Date(nextModule.scheduledDate), new Date())
    : 0;
  const overallPct = orderedModules.length > 0 ? Math.round((completedCount / orderedModules.length) * 100) : 0;
  const nextModuleAttempts = nextModule
    ? myAttempts.filter((a) => a.moduleSlug === nextModule.slug)
    : [];

  return (
    <>
      <PageHeader
        eyebrow={`Welcome back, ${me.name.split(" ")[0]}`}
        title="Your training dashboard"
        description="Track your progress through the BCJ Employee training program."
      />

      {nextModule && !nextModuleSession.sessionEndedAt && (
        <DeliveryLiveSync
          slug={nextModule.slug}
          signature={`${nextModuleSession.checkinOpen}|${!!nextModuleSession.sessionStartedAt}|${!!nextModuleSession.sessionEndedAt}|${nextModuleCheckIn.checkedIn}`}
        />
      )}

      {nextModule && (
        <div className="mb-6">
          <CheckInCard
            manager={{ id: me.id, name: me.name }}
            mod={nextModule}
            initialCheckedIn={nextModuleCheckIn.checkedIn}
            initialCheckedInAt={nextModuleCheckIn.checkedInAt}
            sessionStartedAt={nextModuleSession.sessionStartedAt}
            sessionEndedAt={nextModuleSession.sessionEndedAt}
            checkinOpen={nextModuleSession.checkinOpen}
            alwaysShow={false}
          />
        </div>
      )}

      {nextModule && (
        <div className="grid lg:grid-cols-[1fr_240px] gap-4">
          <QuizStatusCard
            managerId={me.id}
            mod={nextModule}
            myAttempts={nextModuleAttempts}
            isCheckedIn={nextModuleCheckIn.checkedIn}
            sessionStartedAt={nextModuleSession.sessionStartedAt}
            sessionEndedAt={nextModuleSession.sessionEndedAt}
            variant="full"
          />
          <Card className="hidden lg:flex items-center justify-center bg-muted/30">
            <CardContent className="p-6">
              <ProgressRing value={overallPct} />
            </CardContent>
          </Card>
        </div>
      )}

      {nextModule && (
        <div className="mt-3 flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/manager/modules/${nextModule.slug}`}>
              <ArrowRight className="size-3.5 mr-1.5" /> Open {nextModule.title} materials
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            {daysToNext > 0 ? `Training day in ${daysToNext} days` : daysToNext === 0 ? "Training is today" : "Training day has passed"}
          </span>
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">Your 5-module program</h3>
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager/modules">View all <ArrowRight className="ml-1 size-3" /></Link>
          </Button>
        </div>
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {orderedModules.map((m) => {
            const passed = passedSlugs.has(m.slug);
            const isNext = nextModule && m.slug === nextModule.slug;
            const myAttempt = myAttempts.find((a) => a.moduleSlug === m.slug && a.status === "passed");
            return (
              <StaggerItem key={m.slug} className="h-full">
              <Link href={`/manager/modules/${m.slug}`} className="block h-full">
                <Card className="card-lift card-glow h-full">
                  <CardContent className="p-4 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-mono text-muted-foreground">M{m.number}</div>
                      {passed && (
                        <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        </motion.span>
                      )}
                      {isNext && !passed && (
                        <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.5 }}>
                          <Sparkles className="size-4 text-[var(--gold)]" />
                        </motion.span>
                      )}
                    </div>
                    <div className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                      {m.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{m.scheduledMonth}</div>
                    {passed && myAttempt && (
                      <div className="mt-3 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{myAttempt.scorePct}%</span>
                        <span className="text-muted-foreground ml-1">on first try</span>
                      </div>
                    )}
                    {!passed && isNext && (
                      <div className="mt-3 text-xs text-primary font-medium">Up next →</div>
                    )}
                  </CardContent>
                </Card>
              </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="mt-10 grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Your recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {myActivity.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Nothing yet — your activity will appear here.
              </div>
            ) : (
              <ul className="divide-y">
                {myActivity.map((e) => (
                  <li key={e.id} className="py-3 flex items-start gap-3">
                    <Avatar className="size-8 border">
                      <AvatarFallback style={{ background: me.avatarColor, color: "white" }} className="text-xs">
                        {initials(me.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{e.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtRelative(e.occurredAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stat icon={Trophy} label="Modules passed" value={`${me.modulesCompleted} of ${orderedModules.length}`} />
            <Stat icon={Target} label="Average score" value={`${me.averageScore || "—"}${me.averageScore ? "%" : ""}`} />
            <Stat icon={BookOpen} label="Cohort" value={me.cohort ?? "—"} />
            <div className="pt-2">
              <StatusBadge variant={me.status as "active" | "completed" | "at-risk" | "inactive"} />
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 64;
  const circ = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative size-[180px]">
      <svg className="size-full -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circ}
          initial={reduced ? false : { strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold tabular-nums">
          <CountUp value={value} suffix="%" durationMs={1400} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">Program complete</div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center size-9 rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
