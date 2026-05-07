"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  AlertTriangle,
  Trophy,
  Target,
  ArrowRight,
  CheckCircle2,
  X,
  Sparkles,
  FileText,
  RotateCcw,
  UserCheck,
  Play,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  programStats,
  cohortBreakdown,
  moduleProgressBreakdown,
  atRiskManagers,
} from "@/data/queries";
import { recentActivity } from "@/data/activity";
import { allUsers } from "@/data/users";
import { fmtRelative, initials } from "@/lib/format";
import { Stagger, StaggerItem, AnimatedProgress, motion } from "@/components/shared/animations";

const ACTIVITY_ICON = {
  quiz_passed: { Icon: CheckCircle2, color: "text-emerald-500" },
  quiz_failed: { Icon: X, color: "text-rose-500" },
  retake_scheduled: { Icon: Sparkles, color: "text-violet-500" },
  module_published: { Icon: Sparkles, color: "text-emerald-500" },
  module_assigned: { Icon: Sparkles, color: "text-sky-500" },
  user_added: { Icon: Users, color: "text-sky-500" },
  user_deactivated: { Icon: X, color: "text-rose-500" },
  reminder_sent: { Icon: Sparkles, color: "text-amber-500" },
  report_exported: { Icon: FileText, color: "text-sky-500" },
  questions_approved: { Icon: CheckCircle2, color: "text-emerald-500" },
  manager_flagged: { Icon: AlertTriangle, color: "text-amber-500" },
  delivery_rescheduled: { Icon: RotateCcw, color: "text-violet-500" },
  manager_checked_in: { Icon: UserCheck, color: "text-sky-500" },
  session_started: { Icon: Play, color: "text-emerald-500" },
  session_ended: { Icon: Square, color: "text-slate-500" },
} as const;

export default function AdminDashboard() {
  const stats = programStats();
  const cohorts = cohortBreakdown();
  const modules = moduleProgressBreakdown();
  const atRisk = atRiskManagers();

  return (
    <>
      <PageHeader
        eyebrow="BCJ Learn — Admin"
        title="Program health"
        description="Live overview of every Employee, every module, and every score across the BCJ training program."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/reports">
              <FileText className="mr-2 size-4" /> Export report
            </Link>
          </Button>
        }
      />

      {/* KPIs */}
      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StaggerItem><KpiCard label="Total employees" value={stats.totalManagers} icon={Users} delta={{ value: 4 }} /></StaggerItem>
        <StaggerItem><KpiCard label="Pass rate" value={`${stats.passRate}%`} icon={Trophy} accent="success" delta={{ value: 3 }} /></StaggerItem>
        <StaggerItem><KpiCard label="Average score" value={`${stats.avgScore}%`} icon={Target} delta={{ value: -1 }} /></StaggerItem>
        <StaggerItem><KpiCard label="At-risk" value={stats.atRisk} icon={AlertTriangle} accent="warning" delta={{ value: -2 }} /></StaggerItem>
      </Stagger>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Module-by-module performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={modules} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(n) => `M${n}`} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelFormatter={(v) => `Module ${v}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="passed" stackId="r" fill="var(--success)" name="Passed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="r" fill="var(--warning)" name="Failed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Active", value: stats.activeManagers, fill: "var(--chart-1)" },
                      { name: "Completed", value: stats.completed, fill: "var(--success)" },
                      { name: "At-risk", value: stats.atRisk, fill: "var(--warning)" },
                      { name: "Inactive", value: stats.totalManagers - stats.activeManagers - stats.completed - stats.atRisk, fill: "var(--muted-foreground)" },
                    ]}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2 text-sm">
              <Legend2 color="var(--chart-1)" label="Active" value={stats.activeManagers} />
              <Legend2 color="var(--success)" label="Completed" value={stats.completed} />
              <Legend2 color="var(--warning)" label="At-risk" value={stats.atRisk} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohort + activity row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohorts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {cohorts.map((c) => (
                <li key={c.cohort}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.cohort}</span>
                    <span className="text-muted-foreground">{c.total} managers</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden flex">
                    <motion.div className="bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${(c.completed / c.total) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }} />
                    <motion.div className="bg-amber-500" initial={{ width: 0 }} animate={{ width: `${(c.atRisk / c.total) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.25 }} />
                    <motion.div className="bg-primary" initial={{ width: 0 }} animate={{ width: `${(c.active / c.total) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }} />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c.completed} done</span>
                    <span>{c.atRisk} at-risk</span>
                    <span>{c.active} active</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Activity feed</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/audit-log">View all <ArrowRight className="ml-1 size-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Stagger className="divide-y" stagger={0.04}>
              {recentActivity.slice(0, 8).map((e) => {
                const meta = ACTIVITY_ICON[e.kind] ?? ACTIVITY_ICON.quiz_passed;
                const actor = allUsers.find((u) => u.id === e.actorId);
                return (
                  <StaggerItem key={e.id} className="py-3 flex items-start gap-3" y={6}>
                    <div className={`size-9 rounded-md bg-muted flex items-center justify-center ${meta.color}`}>
                      <meta.Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{e.message}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtRelative(e.occurredAt)}</div>
                    </div>
                    {actor && (
                      <Avatar className="size-7 border shrink-0">
                        <AvatarFallback style={{ background: actor.avatarColor, color: "white" }} className="text-[10px]">
                          {initials(actor.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </StaggerItem>
                );
              })}
            </Stagger>
          </CardContent>
        </Card>
      </div>

      {/* At-risk preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">At-risk employees</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Employees who failed twice, missed deadlines, or have not logged in.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/at-risk">All {atRisk.length} <ArrowRight className="ml-1 size-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {atRisk.slice(0, 6).map((m) => (
              <StaggerItem key={m.id}>
              <Link href={`/admin/managers/${m.id}`}>
                <div className="rounded-lg border p-3 hover:border-primary/40 hover:bg-accent/40 transition-all flex items-start gap-3">
                  <Avatar className="size-9 border shrink-0">
                    <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="text-xs">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.cohort} · {m.flaggedReasons[0] ?? "Flagged"}</div>
                    <StatusBadge variant="at-risk" className="mt-1.5" />
                  </div>
                </div>
              </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </CardContent>
      </Card>
    </>
  );
}

function Legend2({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}
