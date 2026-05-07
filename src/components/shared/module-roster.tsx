"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search, Bell, RefreshCcw, ArrowUpRight, Filter, X as XIcon,
  CheckCircle2, XCircle, Clock, AlertTriangle, Users, UserCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { moduleRoster, moduleRosterCounts, type RosterStatus } from "@/data/queries";
import { useAttendanceStore } from "@/store/attendance-store";
import { moduleBySlug } from "@/data/modules";
import { fmtPct, fmtRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

const STATUS_META: Record<RosterStatus, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  pillClass: string;
  iconClass: string;
}> = {
  passed: {
    label: "Took quiz · Passed",
    Icon: CheckCircle2,
    pillClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
    iconClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40",
  },
  failed: {
    label: "Took quiz · Failed",
    Icon: XCircle,
    pillClass: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
    iconClass: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40",
  },
  "checked-in": {
    label: "Checked in",
    Icon: UserCheck,
    pillClass: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
    iconClass: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/40",
  },
  "didnt-attempt": {
    label: "Didn't attempt",
    Icon: AlertTriangle,
    pillClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
    iconClass: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40",
  },
  awaiting: {
    label: "Awaiting",
    Icon: Clock,
    pillClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
    iconClass: "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/40",
  },
};

type FilterKey = "all" | RosterStatus;

interface ModuleRosterProps {
  moduleSlug: string;
  showCohort?: boolean;
  initialFilter?: FilterKey;
  managerLinkBase?: string; // default /admin/managers
}

export function ModuleRoster({
  moduleSlug,
  showCohort = true,
  initialFilter = "all",
  managerLinkBase = "/admin/managers",
}: ModuleRosterProps) {
  // Subscribe to stable map references; derive per-module values inside useMemo
  // (avoids Zustand's "result of getServerSnapshot should be cached" warning).
  const checkedInMap = useAttendanceStore((s) => s.checkedIn);
  const checkedInAtMap = useAttendanceStore((s) => s.checkedInAt);
  const deliveryStartMap = useAttendanceStore((s) => s.deliveryStartDate);
  const managerResetAtMap = useAttendanceStore((s) => s.managerResetAt);
  const resetManager = useAttendanceStore((s) => s.resetManager);

  // Re-delivery cutoff: ONLY use the explicit override.
  // No override = no cutoff = D1 captures all historical attempts.
  // (We avoid silently using the module's scheduledDate as a cutoff because
  // mock attempts can predate that date, and in real life, attempts before
  // the official date are still part of the first delivery.)
  void moduleBySlug; // keep import for type discovery
  const effectiveDeliveryStart = deliveryStartMap[moduleSlug];
  const checkedInIds = checkedInMap[moduleSlug] ?? [];

  const roster = React.useMemo(
    () => moduleRoster(moduleSlug, checkedInIds, checkedInAtMap, effectiveDeliveryStart, managerResetAtMap),
    [moduleSlug, checkedInIds, checkedInAtMap, effectiveDeliveryStart, managerResetAtMap],
  );
  const counts = React.useMemo(
    () => moduleRosterCounts(moduleSlug, checkedInIds, checkedInAtMap, effectiveDeliveryStart, managerResetAtMap),
    [moduleSlug, checkedInIds, checkedInAtMap, effectiveDeliveryStart, managerResetAtMap],
  );

  const [filter, setFilter] = React.useState<FilterKey>(initialFilter);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    return roster.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const hay = `${r.manager.name} ${r.manager.email} ${r.manager.cohort}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [roster, filter, search]);

  const tookQuizPct = counts.expected ? Math.round((counts.tookQuiz / counts.expected) * 100) : 0;
  const passedPct = counts.expected ? Math.round((counts.passed / counts.expected) * 100) : 0;

  return (
    <div>
      {/* Counts strip */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="font-semibold">{counts.expected} expected</span>
              <span className="text-muted-foreground text-sm">on training day</span>
              <span className="ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                Live · {counts.totalPresent} present in room
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <CountChip active={filter === "all"} onClick={() => setFilter("all")} label="All" value={counts.expected} />
              <CountChip
                active={filter === "checked-in"}
                onClick={() => setFilter("checked-in")}
                label="Checked in"
                value={counts.checkedIn}
                tone="info"
              />
              <CountChip active={filter === "passed"} onClick={() => setFilter("passed")} label="Passed" value={counts.passed} tone="success" />
              <CountChip active={filter === "failed"} onClick={() => setFilter("failed")} label="Failed" value={counts.failed} tone="rose" />
              <CountChip
                active={filter === "didnt-attempt"}
                onClick={() => setFilter("didnt-attempt")}
                label="Didn't attempt"
                value={counts.didntAttempt}
                tone="warn"
              />
              {counts.awaiting > 0 && (
                <CountChip active={filter === "awaiting"} onClick={() => setFilter("awaiting")} label="Awaiting" value={counts.awaiting} />
              )}
            </div>
          </div>

          {/* Funnel: Expected → Checked in → Took quiz → Passed */}
          <div className="space-y-2 mt-3">
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              <FunnelCell label="Expected" value={counts.expected} sub="100%" tone="default" />
              <FunnelCell
                label="Checked in / Present"
                value={counts.totalPresent}
                sub={counts.expected ? `${Math.round((counts.totalPresent / counts.expected) * 100)}%` : ""}
                tone="info"
              />
              <FunnelCell
                label="Took quiz"
                value={counts.tookQuiz}
                sub={counts.expected ? `${tookQuizPct}%` : ""}
                tone="info"
              />
              <FunnelCell
                label="Passed"
                value={counts.passed}
                sub={counts.expected ? `${passedPct}%` : ""}
                tone="success"
              />
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="bg-emerald-500" style={{ width: `${passedPct}%` }} title={`Passed: ${counts.passed}`} />
              <div className="bg-rose-500" style={{ width: `${counts.expected ? (counts.failed / counts.expected) * 100 : 0}%` }} title={`Failed: ${counts.failed}`} />
              <div className="bg-sky-400" style={{ width: `${counts.expected ? (counts.checkedIn / counts.expected) * 100 : 0}%` }} title={`Checked in: ${counts.checkedIn}`} />
              <div className="bg-amber-500" style={{ width: `${counts.expected ? (counts.didntAttempt / counts.expected) * 100 : 0}%` }} title={`Didn't attempt: ${counts.didntAttempt}`} />
            </div>
          </div>

          {/* Bulk action banner */}
          {filter === "didnt-attempt" && counts.didntAttempt > 0 && (
            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 flex items-center gap-3 text-sm">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="flex-1">
                <span className="font-semibold">{counts.didntAttempt}</span> employee{counts.didntAttempt === 1 ? "" : "s"} didn&rsquo;t take the quiz on training day. Consider sending a reminder or scheduling a makeup.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Reminder sent to ${counts.didntAttempt} employees`)}
              >
                <Bell className="size-3.5 mr-1.5" /> Remind all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, cohort…"
            className="pl-9 h-9"
          />
        </div>
        {(filter !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilter("all"); setSearch(""); }}>
            <XIcon className="size-3.5 mr-1" /> Reset
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          <Filter className="size-3 inline mr-1" />
          {filtered.length} of {counts.expected}
        </div>
      </div>

      {/* Roster list */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Filter className="size-8 mx-auto mb-2 opacity-40" />
              <div className="font-medium text-foreground">No employees match.</div>
              <div className="text-sm mt-1">Try clearing filters.</div>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((r) => {
                const meta = STATUS_META[r.status];
                const StatusIcon = meta.Icon;
                return (
                  <li key={r.manager.id} className="px-4 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors">
                    <Avatar className="size-9 border shrink-0">
                      <AvatarFallback style={{ background: r.manager.avatarColor, color: "white" }} className="text-xs font-semibold">
                        {initials(r.manager.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.manager.name}</span>
                        {showCohort && (
                          <Badge variant="secondary" className="text-[10px]">{r.manager.cohort}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.manager.email} · last active {fmtRelative(r.manager.lastActiveAt)}
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3 shrink-0">
                      {r.bestScore != null && (
                        <span className="text-xs text-muted-foreground">
                          Best: <span className="font-mono font-semibold text-foreground">{fmtPct(r.bestScore)}</span>
                        </span>
                      )}
                      {r.checkedIn && r.checkedInAt && r.status === "checked-in" && (
                        <span className="text-[11px] text-muted-foreground">
                          Checked in {fmtRelative(r.checkedInAt)}
                        </span>
                      )}
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium",
                        meta.pillClass,
                      )}>
                        <StatusIcon className="size-3" />
                        {meta.label}
                      </span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0">
                          <ArrowUpRight className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`${managerLinkBase}/${r.manager.id}`}>View profile</Link>
                        </DropdownMenuItem>
                        {r.status === "didnt-attempt" && (
                          <>
                            <DropdownMenuItem onClick={() => toast.success(`Reminder sent to ${r.manager.name}`)}>
                              <Bell className="mr-2 size-4" /> Send reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast(`Reschedule modal for ${r.manager.name}`)}>
                              <RefreshCcw className="mr-2 size-4" /> Reschedule
                            </DropdownMenuItem>
                          </>
                        )}
                        {r.status === "failed" && (
                          <DropdownMenuItem onClick={() => toast(`Retake scheduled for ${r.manager.name}`)}>
                            <RefreshCcw className="mr-2 size-4" /> Schedule retake
                          </DropdownMenuItem>
                        )}
                        {(r.status === "passed" || r.status === "failed" || r.status === "didnt-attempt") && (
                          <DropdownMenuItem
                            onClick={() => {
                              resetManager(moduleSlug, r.manager.id);
                              toast.success(`${r.manager.name} reset for next delivery`, {
                                description: "Their past attempts stay in history. Status is now Awaiting.",
                              });
                            }}
                          >
                            <RotateCcw className="mr-2 size-4" /> Reset for next delivery
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountChip({
  active, onClick, label, value, tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number;
  tone?: "success" | "warn" | "rose" | "info";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn"    ? "text-amber-600 dark:text-amber-400" :
    tone === "rose"    ? "text-rose-600 dark:text-rose-400" :
    tone === "info"    ? "text-sky-600 dark:text-sky-400" :
    "text-foreground";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary/10 border-primary/40 text-primary"
          : "bg-card border-border hover:bg-accent",
      )}
    >
      <span>{label}</span>
      <span className={cn("font-mono tabular-nums font-bold", toneClass)}>{value}</span>
    </button>
  );
}

function FunnelCell({
  label, value, sub, tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "default" | "info" | "success";
}) {
  const valClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "info"    ? "text-sky-600 dark:text-sky-400" :
    "text-foreground";
  return (
    <div className="rounded-md border bg-card px-2.5 py-1.5">
      <div className="text-muted-foreground uppercase tracking-wider truncate">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={cn("text-base font-bold tabular-nums", valClass)}>{value}</span>
        {sub && <span className="text-muted-foreground tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}
