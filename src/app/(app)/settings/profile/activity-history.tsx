"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Sparkles, Activity as ActivityIcon, Trophy } from "lucide-react";
import { fmtRelative, fmtDate } from "@/lib/format";
import type { ActivityEvent, Attempt, Role } from "@/types";

interface ActivityHistoryProps {
  activity: ActivityEvent[];
  attempts: Attempt[];
  role: Role;
}

export function ActivityHistory({ activity, attempts, role }: ActivityHistoryProps) {
  return (
    <div className="mt-8 space-y-6 max-w-2xl">
      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="size-4" /> Recent activity
          </CardTitle>
          <CardDescription>The last few actions on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nothing yet — your activity will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {activity.map((e) => (
                <li key={e.id} className="py-2.5 flex items-start gap-3 text-sm">
                  <div className="size-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    {iconFor(e.kind)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div>{e.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{fmtRelative(e.occurredAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Training history (Employees only) */}
      {role === "manager" && attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4" /> Your training history
            </CardTitle>
            <CardDescription>Every quiz attempt across all modules.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {attempts.slice(0, 10).map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.moduleSlug}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{fmtDate(a.startedAt)}</span>
                      <span>·</span>
                      <span className="capitalize">{a.pool.replace("-", " ")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tabular-nums">{a.scorePct}%</span>
                    {a.status === "passed" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]">
                        Passed
                      </Badge>
                    ) : a.status === "failed" ? (
                      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px]">
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] capitalize">{a.status.replace("-", " ")}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function iconFor(kind: string): React.ReactNode {
  if (kind === "quiz_passed" || kind === "questions_approved") return <CheckCircle2 className="size-3.5 text-emerald-500" />;
  if (kind === "quiz_failed") return <X className="size-3.5 text-rose-500" />;
  return <Sparkles className="size-3.5 text-primary" />;
}
