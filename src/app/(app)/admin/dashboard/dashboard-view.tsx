"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  LogIn,
  Calendar,
  ChevronDown,
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
} from "recharts";
import { fmtRelative, fmtDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem, motion } from "@/components/shared/animations";
import type { Manager, Teacher, Admin, ActivityEvent } from "@/types";

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
  user_login: { Icon: LogIn, color: "text-slate-500" },
  resource_updated: { Icon: FileText, color: "text-sky-500" },
} as const;

interface AdminDashboardViewProps {
  stats: {
    totalManagers: number;
    activeManagers: number;
    atRisk: number;
    completed: number;
    passRate: number;
    avgScore: number;
  };
  cohorts: { cohort: string; total: number; completed: number; atRisk: number; active: number }[];
  modules: { slug: string; title: string; number: number; passed: number; failed: number; participation: number; avgScore: number }[];
  atRisk: Manager[];
  recentActivity: ActivityEvent[];
  allUsers: (Manager | Teacher | Admin)[];
  /** Active date-range filter (YYYY-MM-DD). Empty string = all time. */
  from: string;
  to: string;
}

export function AdminDashboardView({
  stats,
  cohorts,
  modules,
  atRisk,
  recentActivity,
  allUsers,
  from,
  to,
}: AdminDashboardViewProps) {
  const router = useRouter();

  // Click a module's bar → drill into that module's attempts. Handles both a
  // Bar-level datum (payload/slug) and the chart-level state (activePayload) so
  // the click registers reliably when the bar itself is clicked.
  const onBarClick = (data: unknown) => {
    const d = data as {
      slug?: string;
      payload?: { slug?: string };
      activePayload?: { payload?: { slug?: string } }[];
    };
    const slug = d?.slug ?? d?.payload?.slug ?? d?.activePayload?.[0]?.payload?.slug;
    if (slug) router.push(`/admin/results?module=${slug}`);
  };

  // Click a pie slice → drill into the people with that status.
  const onPieClick = (d: unknown) => {
    const e = d as { status?: string; payload?: { status?: string } };
    const status = e?.status ?? e?.payload?.status;
    if (!status) return;
    router.push(status === "at-risk" ? "/admin/at-risk" : `/admin/managers?status=${status}`);
  };

  // ─── Date-range dropdown ───────────────────────────────────────────────
  // A single compact dropdown in the header holds the presets + a custom range.
  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState(from);
  const [customTo, setCustomTo] = React.useState(to);
  React.useEffect(() => { setCustomFrom(from); setCustomTo(to); }, [from, to]);

  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  function applyRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const qs = params.toString();
    setRangeOpen(false);
    router.push(qs ? `/admin/dashboard?${qs}` : "/admin/dashboard");
  }
  function applyPreset(kind: "all" | "year" | "d90" | "d30") {
    if (kind === "all") return applyRange("", "");
    const now = new Date();
    if (kind === "year") return applyRange(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
    const days = kind === "d90" ? 90 : 30;
    return applyRange(isoDate(new Date(now.getTime() - days * 24 * 3600 * 1000)), isoDate(now));
  }
  const PRESETS: { key: "all" | "year" | "d90" | "d30"; label: string }[] = [
    { key: "all", label: "All time" },
    { key: "year", label: "This year" },
    { key: "d90", label: "Last 90 days" },
    { key: "d30", label: "Last 30 days" },
  ];
  const fmtRange = (s: string) => fmtDate(s, "MMM d, yyyy");
  const rangeLabel = !from && !to
    ? "All time"
    : from && to ? `${fmtRange(from)} – ${fmtRange(to)}`
    : from ? `From ${fmtRange(from)}`
    : `Until ${fmtRange(to)}`;

  return (
    <>
      <PageHeader
        eyebrow="BCJ Learn — Admin"
        title="Program health"
        description="Live overview of every Employee, every module, and every score across the BCJ training program."
        actions={
          <div className="flex items-center gap-2">
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Calendar className="mr-2 size-4" />
                  <span className="max-w-[180px] truncate">{rangeLabel}</span>
                  <ChevronDown className="ml-2 size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0 gap-0 overflow-hidden">
                <div className="p-2">
                  <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quick ranges</div>
                  <div className="grid grid-cols-2 gap-1">
                    {PRESETS.map((p) => {
                      const active = p.key === "all" && !from && !to;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => applyPreset(p.key)}
                          className={cn(
                            "rounded-md px-2.5 py-1.5 text-sm text-left transition-colors",
                            active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t p-3 space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Custom range</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">From</Label>
                      <Input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">To</Label>
                      <Input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <Button size="sm" className="w-full" disabled={!customFrom && !customTo} onClick={() => applyRange(customFrom, customTo)}>
                    Apply range
                  </Button>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Applies to pass rate, average score &amp; module performance. Employee status and cohorts always show the current snapshot.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
            <Button asChild variant="outline">
              <Link href="/admin/reports">
                <FileText className="mr-2 size-4" /> Export report
              </Link>
            </Button>
          </div>
        }
      />

      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StaggerItem><KpiCard label="Total employees" value={stats.totalManagers} icon={Users} delta={{ value: 4 }} href="/admin/managers" /></StaggerItem>
        <StaggerItem><KpiCard label="Pass rate" value={`${stats.passRate}%`} icon={Trophy} accent="success" delta={{ value: 3 }} href="/admin/results?status=passed" /></StaggerItem>
        <StaggerItem><KpiCard label="Average score" value={`${stats.avgScore}%`} icon={Target} delta={{ value: -1 }} href="/admin/results" /></StaggerItem>
        <StaggerItem><KpiCard label="At-risk" value={stats.atRisk} icon={AlertTriangle} accent="warning" delta={{ value: -2 }} href="/admin/at-risk" /></StaggerItem>
      </Stagger>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Module-by-module performance</CardTitle>
            <p className="text-xs text-muted-foreground">Click a module to see its attempts.</p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={modules} margin={{ top: 10, right: 10, bottom: 5, left: -20 }} onClick={onBarClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(n) => `M${n}`} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} labelFormatter={(v) => `Module ${v}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="passed" stackId="r" fill="var(--success)" name="Passed" radius={[0, 0, 0, 0]} onClick={onBarClick} className="cursor-pointer" />
                  <Bar dataKey="failed" stackId="r" fill="var(--warning)" name="Failed" radius={[6, 6, 0, 0]} onClick={onBarClick} className="cursor-pointer" />
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
                      { name: "Active", value: stats.activeManagers, fill: "var(--chart-1)", status: "active" },
                      { name: "Completed", value: stats.completed, fill: "var(--success)", status: "completed" },
                      { name: "At-risk", value: stats.atRisk, fill: "var(--warning)", status: "at-risk" },
                      { name: "Inactive", value: stats.totalManagers - stats.activeManagers - stats.completed - stats.atRisk, fill: "var(--muted-foreground)", status: "inactive" },
                    ]}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    onClick={onPieClick}
                    className="cursor-pointer outline-none"
                  />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
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

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohorts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {cohorts.map((c) => (
                <li key={c.cohort}>
                  <Link
                    href={`/admin/managers?cohort=${encodeURIComponent(c.cohort)}`}
                    className="block rounded-md p-1.5 -m-1.5 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.cohort}</span>
                      <span className="text-muted-foreground">{c.total} employees</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden flex">
                      <motion.div className="bg-emerald-500" initial={{ width: 0 }} animate={{ width: c.total ? `${(c.completed / c.total) * 100}%` : "0%" }} transition={{ duration: 0.9, delay: 0.1 }} />
                      <motion.div className="bg-amber-500" initial={{ width: 0 }} animate={{ width: c.total ? `${(c.atRisk / c.total) * 100}%` : "0%" }} transition={{ duration: 0.9, delay: 0.25 }} />
                      <motion.div className="bg-primary" initial={{ width: 0 }} animate={{ width: c.total ? `${(c.active / c.total) * 100}%` : "0%" }} transition={{ duration: 0.9, delay: 0.4 }} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.completed} done</span>
                      <span>{c.atRisk} at-risk</span>
                      <span>{c.active} active</span>
                    </div>
                  </Link>
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
                        <AvatarImage src={actor.avatarUrl ?? undefined} alt={actor.name} className="object-cover" />
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
                      <AvatarImage src={m.avatarUrl ?? undefined} alt={m.name} className="object-cover" />
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
