"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, ListChecks, Users, PresentationIcon, BarChart3, Edit3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { fmtDate } from "@/lib/format";
import type { ModuleDef, Attempt } from "@/types";

export interface TeacherDashboardViewProps {
  me: { id: string; name: string };
  myModules: ModuleDef[];
  attemptsByModule: Record<string, Attempt[]>;
}

export function TeacherDashboardView({ me, myModules, attemptsByModule }: TeacherDashboardViewProps) {
  const totalQuestions = myModules.reduce((s, m) => s + m.questionsTotal, 0);
  const approvedQuestions = myModules.reduce((s, m) => s + m.questionsApproved, 0);
  const pendingQuestions = totalQuestions - approvedQuestions;

  const totalAttempts = myModules.reduce((s, m) => s + (attemptsByModule[m.slug]?.length ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow={`Welcome, ${me.name.split(" ")[0]}`}
        title="Your modules at a glance"
        description="Approve AI-drafted questions, watch results roll in, and refine for the next cohort."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard label="My modules" value={myModules.length} icon={BookOpen} />
        <KpiCard label="Questions approved" value={approvedQuestions} icon={ListChecks} accent="success" />
        <KpiCard label="Pending review" value={pendingQuestions} icon={Sparkles} accent="ai" />
        <KpiCard label="Quiz attempts" value={totalAttempts} icon={Users} />
      </div>

      <h3 className="text-lg font-semibold tracking-tight mb-4">Modules you own</h3>
      <div className="grid lg:grid-cols-2 gap-4">
        {myModules.map((m) => {
          const approvedPct = m.questionsTotal === 0 ? 0 : Math.round((m.questionsApproved / m.questionsTotal) * 100);
          const moduleAttempts = attemptsByModule[m.slug] ?? [];
          const passRate = moduleAttempts.length
            ? Math.round((moduleAttempts.filter((a) => a.status === "passed").length / moduleAttempts.length) * 100)
            : 0;
          return (
            <Card key={m.slug} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">M{m.number} · {m.scheduledMonth}</div>
                    <CardTitle className="text-lg mt-1">{m.title}</CardTitle>
                  </div>
                  <StatusBadge variant={m.status} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Question bank</span>
                    <span className="font-mono tabular-nums">{m.questionsApproved} / {m.questionsTotal}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${approvedPct}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md border p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Pass rate</div>
                    <div className="font-bold tabular-nums">{passRate || "—"}{passRate ? "%" : ""}</div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Attempts</div>
                    <div className="font-bold tabular-nums">{moduleAttempts.length}</div>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Training day</div>
                    <div className="font-bold text-xs">{m.scheduledDate ? fmtDate(m.scheduledDate, "MMM d") : "—"}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button asChild size="sm" className="col-span-2">
                    <Link href={`/teacher/modules/${m.slug}/present`}>
                      <PresentationIcon className="mr-1.5 size-3.5" /> Present in seminar
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/teacher/modules/${m.slug}/content`}>
                      <Edit3 className="mr-1.5 size-3.5" /> Edit content
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/teacher/modules/${m.slug}/questions`}>
                      <ListChecks className="mr-1.5 size-3.5" /> Questions
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="col-span-2">
                    <Link href={`/teacher/modules/${m.slug}/results`}>
                      <BarChart3 className="mr-1.5 size-3.5" /> See results
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
