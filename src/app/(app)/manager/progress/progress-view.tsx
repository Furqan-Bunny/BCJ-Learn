"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, ArrowUpRight, Clock, History, Target } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { fmtDate, fmtRelative, fmtPct } from "@/lib/format";
import type { ModuleDef, Attempt, ManagerStatus } from "@/types";

export interface ManagerProgressViewProps {
  me: {
    id: string;
    modulesCompleted: number;
    averageScore: number;
    status: ManagerStatus;
  };
  modules: ModuleDef[];
  myAttempts: Attempt[];
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDuration(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ManagerProgressView({ me, modules, myAttempts }: ManagerProgressViewProps) {
  const ordered = [...modules].sort((a, b) => a.number - b.number);
  const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));

  // Full attempt history — newest first.
  const history = [...myAttempts].sort(
    (a, b) => +new Date(b.submittedAt ?? b.startedAt) - +new Date(a.submittedAt ?? a.startedAt),
  );

  return (
    <>
      <PageHeader
        eyebrow="Your progress"
        title="My training history"
        description="Every module, every attempt, every score. This is what your supervisor sees too."
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Modules passed</div>
            <div className="text-3xl font-bold tabular-nums mt-2">
              {me.modulesCompleted} <span className="text-muted-foreground text-base font-normal">of {ordered.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Average score</div>
            <div className="text-3xl font-bold tabular-nums mt-2">
              {me.averageScore || "—"}
              <span className="text-muted-foreground text-base font-normal">{me.averageScore ? "%" : ""}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Quiz attempts</div>
            <div className="text-3xl font-bold tabular-nums mt-2">{history.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Full attempt history ──────────────────────────────────── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><History className="size-4 text-muted-foreground" /> Quiz history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              You haven&rsquo;t taken any quizzes yet. Once you attend a seminar and take the quiz, every attempt shows up here.
            </div>
          ) : (
            <ul className="divide-y">
              {history.map((a) => {
                const m = moduleBySlug.get(a.moduleSlug);
                const passed = a.status === "passed";
                const when = a.submittedAt ?? a.startedAt;
                const duration = fmtDuration(a.durationSec);
                return (
                  <li key={a.id} className="py-4 flex items-start gap-4">
                    <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${passed ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
                      {passed ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{m ? `M${m.number}: ${m.title}` : a.moduleSlug}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {a.pool === "retake" ? "Retake" : "First attempt"}
                        </Badge>
                        <StatusBadge variant={a.status as "passed" | "failed"} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {fmtDateTime(when)}</span>
                        <span className="flex items-center gap-1.5"><Target className="size-3.5" /> {a.correctCount}/{a.totalCount} correct</span>
                        {duration && <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {duration}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-mono text-lg font-bold tabular-nums w-14 text-right ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {fmtPct(a.scorePct)}
                      </span>
                      {m && (
                        <Link href={`/manager/modules/${m.slug}`} className="text-primary hover:bg-accent rounded-md p-1.5">
                          <ArrowUpRight className="size-4" />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ─── Module-by-module overview ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module-by-module</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {ordered.map((m) => {
              const attempts = myAttempts.filter((a) => a.moduleSlug === m.slug);
              const latest = [...attempts].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))[0];
              const passed = attempts.some((a) => a.status === "passed");
              return (
                <li key={m.slug} className="py-4 flex items-center gap-4">
                  <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${passed ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {passed ? <CheckCircle2 className="size-5" /> : <Calendar className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">M{m.number}: {m.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {attempts.length > 0
                        ? `${attempts.length} attempt${attempts.length > 1 ? "s" : ""} · last ${fmtRelative(latest.startedAt)}`
                        : m.scheduledDate
                          ? `Scheduled ${fmtDate(m.scheduledDate)}`
                          : "Not yet scheduled"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {latest && <StatusBadge variant={latest.status as "passed" | "failed"} />}
                    {latest?.scorePct ? (
                      <span className="font-mono text-sm font-semibold tabular-nums w-12 text-right">{fmtPct(latest.scorePct)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground w-12 text-right">—</span>
                    )}
                    <Link href={`/manager/modules/${m.slug}`} className="text-primary hover:bg-accent rounded-md p-1.5">
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
