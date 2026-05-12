"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle2, ArrowUpRight } from "lucide-react";
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

export function ManagerProgressView({ me, modules, myAttempts }: ManagerProgressViewProps) {
  const ordered = [...modules].sort((a, b) => a.number - b.number);

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
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Status</div>
            <div className="mt-2"><StatusBadge variant={me.status} /></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module-by-module</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {ordered.map((m) => {
              const attempts = myAttempts.filter((a) => a.moduleSlug === m.slug);
              const latest = attempts.sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))[0];
              const passed = attempts.some((a) => a.status === "passed");
              return (
                <li key={m.slug} className="py-4 flex items-center gap-4">
                  <div className={`size-10 rounded-md flex items-center justify-center shrink-0 ${passed ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {passed ? <CheckCircle2 className="size-5" /> : <Calendar className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">M{m.number}: {m.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {latest
                        ? `Last attempt: ${fmtRelative(latest.startedAt)}`
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
