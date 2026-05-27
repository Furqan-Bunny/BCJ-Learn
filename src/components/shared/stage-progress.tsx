"use client";

// Vertical staged-progress list — shows each step of a long operation
// (extract → summarize → generate …) as pending / active / done, with the
// active step spinning and an optional live detail line. Driven by the parent.

import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageStatus = "pending" | "active" | "done";

export interface Stage {
  label: string;
  status: StageStatus;
  detail?: string;
}

export function StageProgress({ stages }: { stages: Stage[] }) {
  const done = stages.filter((s) => s.status === "done").length;
  const pct = stages.length ? Math.round((done / stages.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2.5">
        {stages.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {s.status === "done" ? (
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              ) : s.status === "active" ? (
                <Loader2 className="size-5 text-primary animate-spin" />
              ) : (
                <Circle className="size-5 text-muted-foreground/40" />
              )}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  s.status === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {s.label}
              </div>
              {s.detail && s.status !== "pending" && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
