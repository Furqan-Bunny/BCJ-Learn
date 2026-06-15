"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { ModuleRoster } from "@/components/shared/module-roster";
import { fmtDate, fmtPct } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Trophy, Users, Target, AlertTriangle, ArrowLeft } from "lucide-react";
import type { ModuleDef, Attempt, Question, Manager } from "@/types";
import type { RosterRow, RosterCounts } from "@/lib/db/roster";

export interface TeacherModuleResultsViewProps {
  mod: ModuleDef;
  attempts: Attempt[];
  questions: Question[];
  managersById: Record<string, Manager>;
  distribution: { range: string; count: number }[];
  roster: RosterRow[];
  counts: RosterCounts;
}

export function TeacherModuleResultsView({
  mod,
  attempts,
  questions,
  managersById,
  distribution,
  roster,
  counts,
}: TeacherModuleResultsViewProps) {
  const slug = mod.slug;
  // Only submitted attempts (passed/failed) count — scheduled retakes and
  // abandoned in-progress rows are not real attempts.
  const submittedAttempts = attempts.filter((a) => a.status === "passed" || a.status === "failed");
  const passed = submittedAttempts.filter((a) => a.status === "passed").length;
  const failed = submittedAttempts.filter((a) => a.status === "failed").length;
  const passRate = submittedAttempts.length ? Math.round((passed / submittedAttempts.length) * 100) : 0;
  const avgScore = submittedAttempts.length
    ? Math.round(submittedAttempts.reduce((s, a) => s + Number(a.scorePct), 0) / submittedAttempts.length)
    : 0;

  const mostMissed = [...questions].sort((a, b) => b.missRate - a.missRate).slice(0, 5);

  const recent = submittedAttempts
    .slice()
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
    .slice(0, 12);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/teacher/modules/${slug}`}><ArrowLeft className="size-4 mr-1" /> Back to module</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} results`}
        title={mod.title}
        description="How this module is performing across cohorts."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Attempts" value={submittedAttempts.length} icon={Users} />
        <KpiCard label="Pass rate" value={`${passRate}%`} icon={Trophy} accent="success" />
        <KpiCard label="Avg score" value={`${avgScore}%`} icon={Target} />
        <KpiCard label="Failed" value={failed} icon={AlertTriangle} accent="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={distribution} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    cursor={{ fill: "var(--muted)" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {distribution.map((d, i) => (
                      <Cell key={i} fill={i < 3 ? "var(--warning)" : "var(--success)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Pass threshold: {Math.round(mod.passThreshold * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most-missed questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {mostMissed.map((q, i) => (
                <li key={q.id} className="flex items-start gap-3">
                  <div className="size-7 rounded-md bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center text-xs font-semibold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{q.text}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <StatusBadge variant={q.pool} />
                      <span>
                        Miss rate:{" "}
                        <span className="font-mono font-semibold text-rose-600">{Math.round(q.missRate * 100)}%</span>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold tracking-tight mb-3 mt-2">Roster — who attended &amp; how they did</h3>
      <ModuleRoster moduleSlug={slug} roster={roster} counts={counts} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Recent attempts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Manager</th>
                <th className="text-left px-5 py-2.5 font-medium">Date</th>
                <th className="text-left px-5 py-2.5 font-medium">Pool</th>
                <th className="text-left px-5 py-2.5 font-medium">Score</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((a) => {
                const m = managersById[a.managerId];
                return (
                  <tr key={a.id} className="hover:bg-accent/40">
                    <td className="px-5 py-3 font-medium">{m?.name ?? a.managerId}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{fmtDate(a.startedAt)}</td>
                    <td className="px-5 py-3"><StatusBadge variant={a.pool} /></td>
                    <td className="px-5 py-3 font-mono tabular-nums">{fmtPct(a.scorePct)}</td>
                    <td className="px-5 py-3"><StatusBadge variant={a.status as "passed" | "failed"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
