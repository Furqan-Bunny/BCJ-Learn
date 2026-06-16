"use client";

// "Training assigned to you" — shown on the Department Lead / Admin dashboards so
// non-managers who've been assigned to a module (per Nancy's Jun-16 request that
// any user can take a quiz) have a way in. Cards link to the manager-side module
// page, which works for any signed-in user. Hidden when nothing is assigned.

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ArrowRight, CheckCircle2, RotateCcw, Clock } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { Attempt, ModuleDef } from "@/types";

function latestStatus(attempts: Attempt[]): "passed" | "failed" | "none" {
  const submitted = attempts
    .filter((a) => a.status === "passed" || a.status === "failed")
    .sort((a, b) => +new Date(b.submittedAt ?? b.startedAt) - +new Date(a.submittedAt ?? a.startedAt));
  if (attempts.some((a) => a.status === "passed")) return "passed";
  if (submitted.length > 0) return "failed";
  return "none";
}

export function AssignedTraining({
  modules,
  attempts,
}: {
  modules: ModuleDef[];
  attempts: Attempt[];
}) {
  if (modules.length === 0) return null;

  return (
    <Card className="mb-6 border-[var(--gold)]/30 bg-[var(--gold)]/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="size-4 text-[var(--gold-foreground)]" />
          <h2 className="text-sm font-semibold">Training assigned to you</h2>
          <Badge variant="outline" className="text-[10px]">{modules.length}</Badge>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((m) => {
            const status = latestStatus(attempts.filter((a) => a.moduleSlug === m.slug));
            const cta =
              status === "passed" ? "Review" : status === "failed" ? "Retake quiz" : "View module";
            return (
              <div key={m.slug} className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Module {m.number}
                    </div>
                    <div className="text-sm font-medium truncate">{m.title}</div>
                  </div>
                  {status === "passed" ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : status === "failed" ? (
                    <RotateCcw className="size-4 text-amber-500 shrink-0" />
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3" />
                  {m.scheduledDate ? fmtDate(m.scheduledDate) : m.scheduledMonth || "—"}
                </div>
                <Button asChild size="sm" variant="outline" className="mt-auto justify-between">
                  <Link href={`/manager/modules/${m.slug}`}>
                    {cta} <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
