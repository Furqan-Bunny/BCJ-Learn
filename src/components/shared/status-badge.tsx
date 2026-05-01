import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant =
  | "active" | "at-risk" | "completed" | "inactive"
  | "passed" | "failed" | "in-progress" | "scheduled"
  | "draft" | "published" | "archived"
  | "approved" | "pending" | "rejected" | "edited"
  | "ai" | "first-attempt" | "retake";

const STYLES: Record<Variant, string> = {
  active:        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  "at-risk":     "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  completed:     "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  inactive:      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
  passed:        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  failed:        "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
  "in-progress": "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  scheduled:     "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  draft:         "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
  published:     "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  archived:      "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",
  approved:      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  pending:       "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  rejected:      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
  edited:        "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  ai:            "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  "first-attempt": "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  retake:        "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
};

const LABELS: Record<Variant, string> = {
  active: "Active",
  "at-risk": "At-risk",
  completed: "Completed",
  inactive: "Inactive",
  passed: "Passed",
  failed: "Failed",
  "in-progress": "In progress",
  scheduled: "Scheduled",
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  edited: "Edited",
  ai: "AI-drafted",
  "first-attempt": "First attempt",
  retake: "Retake",
};

export function StatusBadge({ variant, className, label }: { variant: Variant; className?: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium border", STYLES[variant], className)}>
      {label ?? LABELS[variant]}
    </Badge>
  );
}
