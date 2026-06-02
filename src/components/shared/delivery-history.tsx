"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  History, Calendar, Users, Trophy, AlertTriangle, ChevronDown, ChevronUp,
  ArrowUpRight, Clock,
} from "lucide-react";
import { fmtDate, fmtPct, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DeliveryRecord } from "@/lib/db/deliveries";
import type { Manager, Attempt } from "@/types";

interface DeliveryHistoryProps {
  moduleSlug: string;
  deliveries: DeliveryRecord[];
  managersById: Record<string, Pick<Manager, "id" | "name" | "avatarColor" | "cohort" | "avatarUrl">>;
  attempts: Attempt[];
  managerLinkBase?: string;
}

export function DeliveryHistory({
  moduleSlug,
  deliveries,
  managersById,
  attempts,
  managerLinkBase = "/admin/managers",
}: DeliveryHistoryProps) {
  const [expandedIdx, setExpandedIdx] = React.useState<Set<number>>(() => {
    const cur = deliveries.find((d) => d.isCurrent);
    return new Set(cur ? [cur.index] : []);
  });

  function toggle(idx: number) {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (deliveries.length === 0) return null;

  const totalDeliveries = deliveries.length;
  const totalAttempts = deliveries.reduce((s, d) => s + d.attempts, 0);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <span className="font-semibold">Delivery history</span>
            <Badge variant="secondary" className="text-[10px] font-mono">{totalDeliveries}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {totalAttempts} total attempts across all deliveries
          </div>
        </div>

        <ul className="divide-y">
          {deliveries.map((d) => {
            const expanded = expandedIdx.has(d.index);
            const passRate = d.attempts ? Math.round((d.passed / d.attempts) * 100) : 0;
            const participants = d.participantIds
              .map((id) => managersById[id])
              .filter((m): m is NonNullable<typeof m> => !!m);

            return (
              <li key={d.startDate}>
                <button
                  onClick={() => toggle(d.index)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors"
                >
                  <div className={cn(
                    "size-10 rounded-md shrink-0 flex flex-col items-center justify-center text-[10px] uppercase tracking-wider",
                    d.isCurrent
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}>
                    <span className="font-bold text-base">D{d.index}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {d.isCurrent ? "Current delivery" : `Delivery ${d.index}`}
                      </span>
                      {d.isCurrent ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Archived</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3" /> Started {fmtDate(d.startDate)}
                      </span>
                      {d.endDate && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3" /> Ended {fmtDate(d.endDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
                    <Stat icon={Users} label="Attendees" value={d.participantIds.length} />
                    <Stat icon={Trophy} label="Passed" value={d.passed} tone="success" />
                    {d.failed > 0 && <Stat icon={AlertTriangle} label="Failed" value={d.failed} tone="warn" />}
                    {d.attempts > 0 && (
                      <span className="text-muted-foreground">
                        Pass rate <span className="font-mono font-semibold text-foreground">{passRate}%</span>
                      </span>
                    )}
                  </div>

                  {expanded ? <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="px-5 pb-5 -mt-1 border-t bg-muted/20">
                    {participants.length === 0 ? (
                      <div className="py-4 text-xs text-muted-foreground text-center italic">
                        No quiz attempts in this delivery yet.
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground py-3">
                          Who took this delivery ({participants.length})
                        </div>
                        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {participants.map((m) => {
                            const startMs = new Date(d.startDate).getTime();
                            const endMs = d.endDate ? new Date(d.endDate).getTime() : Infinity;
                            const myAttempts = attempts.filter(
                              (a) =>
                                a.managerId === m.id &&
                                a.moduleSlug === moduleSlug &&
                                +new Date(a.startedAt) >= startMs &&
                                +new Date(a.startedAt) < endMs,
                            );
                            const best = myAttempts.length
                              ? myAttempts.reduce((b, a) => (a.scorePct > b.scorePct ? a : b))
                              : null;
                            const passed = best?.status === "passed";

                            return (
                              <li key={m.id}>
                                <Link
                                  href={`${managerLinkBase}/${m.id}`}
                                  className="flex items-center gap-2 px-2.5 py-2 rounded-md border bg-card hover:bg-accent/40 transition-colors"
                                >
                                  <Avatar className="size-7 border shrink-0">
                                    <AvatarImage src={m.avatarUrl ?? undefined} alt={m.name} className="object-cover" />
                                    <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="text-[10px] font-semibold">
                                      {initials(m.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">{m.name}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {m.cohort} · {best ? fmtDate(best.startedAt, "MMM d, yyyy") : "—"}
                                    </div>
                                  </div>
                                  {best && (
                                    <span className={cn(
                                      "text-[11px] font-mono font-semibold tabular-nums shrink-0",
                                      passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                                    )}>
                                      {fmtPct(best.scorePct)}
                                    </span>
                                  )}
                                  <ArrowUpRight className="size-3 text-muted-foreground/50 shrink-0" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "success" | "warn";
}) {
  const valClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn"    ? "text-amber-600 dark:text-amber-400" :
    "text-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-mono tabular-nums font-semibold", valClass)}>{value}</span>
    </span>
  );
}
