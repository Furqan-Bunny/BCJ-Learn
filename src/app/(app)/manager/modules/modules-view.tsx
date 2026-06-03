"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, Calendar, FileText, PlayCircle, Clock, RefreshCcw, Lock, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { MAX_STRIKES } from "@/lib/quiz-pool";
import { Search } from "lucide-react";
import { Stagger, StaggerItem, SearchLoadingBar, AnimatePresence, motion } from "@/components/shared/animations";
import type { ModuleDef, Attempt } from "@/types";

type CardStatus =
  | { kind: "passed"; scorePct: number }
  | { kind: "retake"; attemptsRemaining: number; lastScore: number }
  | { kind: "locked"; lastScore: number }
  | { kind: "in-progress" }
  | { kind: "not-started" };

/** Derive a module card's status from a manager's attempts (no check-in context here). */
function cardStatus(attempts: Attempt[]): CardStatus {
  const passed = attempts.find((a) => a.status === "passed");
  if (passed) return { kind: "passed", scorePct: passed.scorePct };
  const failed = attempts.filter((a) => a.status === "failed");
  if (failed.length >= MAX_STRIKES) {
    return { kind: "locked", lastScore: failed[failed.length - 1].scorePct };
  }
  if (failed.length >= 1) {
    return { kind: "retake", attemptsRemaining: MAX_STRIKES - failed.length, lastScore: failed[failed.length - 1].scorePct };
  }
  if (attempts.some((a) => a.status === "in-progress")) return { kind: "in-progress" };
  return { kind: "not-started" };
}

const STATUS_BADGE: Record<CardStatus["kind"], { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  passed:        { label: "Passed",       cls: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20", icon: CheckCircle2 },
  retake:        { label: "Retake",       cls: "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/20", icon: RefreshCcw },
  locked:        { label: "Out of attempts", cls: "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/20", icon: Lock },
  "in-progress": { label: "In progress",  cls: "border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-50/60 dark:bg-sky-950/20", icon: Hourglass },
  "not-started": { label: "Available now", cls: "border-primary/40 text-primary bg-primary/[0.04]", icon: Sparkles },
};

type FilterKey = "all" | "todo" | "passed" | "action";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "action", label: "Needs action" },
  { key: "passed", label: "Passed" },
];

function matchesFilter(status: CardStatus, filter: FilterKey): boolean {
  switch (filter) {
    case "all": return true;
    case "passed": return status.kind === "passed";
    case "action": return status.kind === "retake" || status.kind === "locked";
    case "todo": return status.kind === "not-started" || status.kind === "in-progress";
  }
}

function totalMinutes(m: ModuleDef): number {
  return m.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
}

function contentCounts(m: ModuleDef) {
  const all = m.lessons.flatMap((l) => l.contents);
  return {
    videos: all.filter((c) => c.type === "video").length,
    documents: all.filter((c) => c.type === "document").length,
    slides: all.filter((c) => c.type === "slides").length,
    links: all.filter((c) => c.type === "link").length,
  };
}

export interface ManagerModulesViewProps {
  modules: ModuleDef[];
  myAttempts: Attempt[];
}

export function ManagerModulesView({ modules, myAttempts }: ManagerModulesViewProps) {
  const passedSlugs = new Set(myAttempts.filter((a) => a.status === "passed").map((a) => a.moduleSlug));
  // Group each manager's attempts by module so we can derive a per-card status.
  const attemptsBySlug = React.useMemo(() => {
    const map = new Map<string, Attempt[]>();
    for (const a of myAttempts) {
      const list = map.get(a.moduleSlug) ?? [];
      list.push(a);
      map.set(a.moduleSlug, list);
    }
    return map;
  }, [myAttempts]);
  // Every published module is unlocked — no sequential gating. Show only
  // published modules, ordered by scheduled training day (soonest first).
  const orderKey = (m: (typeof modules)[number]) =>
    m.scheduledDate ? new Date(m.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
  const ordered = modules
    .filter((m) => m.status === "published")
    .sort((a, b) => orderKey(a) - orderKey(b) || a.number - b.number);
  const nextModule = ordered.find((m) => !passedSlugs.has(m.slug));

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const statusFor = React.useCallback(
    (slug: string) => cardStatus(attemptsBySlug.get(slug) ?? []),
    [attemptsBySlug],
  );

  const filterCounts = React.useMemo(() => {
    const c: Record<FilterKey, number> = { all: ordered.length, todo: 0, action: 0, passed: 0 };
    for (const m of ordered) {
      const st = statusFor(m.slug);
      if (matchesFilter(st, "todo")) c.todo++;
      if (matchesFilter(st, "action")) c.action++;
      if (matchesFilter(st, "passed")) c.passed++;
    }
    return c;
  }, [ordered, statusFor]);

  const filtered = ordered.filter((m) => {
    const matchesQuery =
      m.title.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && matchesFilter(statusFor(m.slug), filter);
  });

  React.useEffect(() => {
    if (!query) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => setSearching(false), 320);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="The 5-module program"
        description="One module per month, June through October 2026. Pass each to unlock the next."
      />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searching ? "text-primary" : "text-muted-foreground"}`} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            className="pl-9 h-10 transition-shadow focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
          />
          <SearchLoadingBar active={searching} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">{filterCounts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((m) => {
          const passed = passedSlugs.has(m.slug);
          const isNext = nextModule?.slug === m.slug;
          const counts = contentCounts(m);
          const status = statusFor(m.slug);
          const badge = STATUS_BADGE[status.kind];
          const BadgeIcon = badge.icon;

          return (
            <StaggerItem key={m.slug} className="h-full">
              <Card className="overflow-hidden card-lift card-glow h-full">
                <CardContent className="p-0 h-full">
                  <div className="grid grid-cols-[auto_1fr] gap-0 h-full">
                    <div className="bg-primary/5 border-r flex flex-col items-center justify-center p-6 min-w-[100px]">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Module</div>
                      <div className="text-4xl font-bold tracking-tight text-primary mt-1 tabular-nums">{m.number}</div>
                      {passed && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.2 }}>
                          <CheckCircle2 className="size-5 text-emerald-500 mt-2" />
                        </motion.span>
                      )}
                      {isNext && !passed && (
                        <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}>
                          <Sparkles className="size-5 text-[var(--gold)] mt-2" />
                        </motion.span>
                      )}
                    </div>
                    <div className="p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-lg tracking-tight">{m.title}</div>
                        <Badge variant="outline" className={cn("shrink-0 gap-1 text-[11px]", badge.cls)}>
                          <BadgeIcon className="size-3" /> {badge.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{m.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                        {m.scheduledDate && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="size-3.5" /> {fmtDate(m.scheduledDate)}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5" /> {totalMinutes(m)} min · {m.lessons.length} lessons
                        </span>
                        <span className="flex items-center gap-1.5">
                          <PlayCircle className="size-3.5" /> {counts.videos} videos
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FileText className="size-3.5" /> {counts.documents} docs
                        </span>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                        <div className="text-xs font-medium">
                          {status.kind === "passed" && (
                            <span className="text-emerald-600 dark:text-emerald-400">Passed at {status.scorePct}%</span>
                          )}
                          {status.kind === "retake" && (
                            <span className="text-amber-600 dark:text-amber-400">
                              Scored {status.lastScore}% · {status.attemptsRemaining} of {MAX_STRIKES} attempts left
                            </span>
                          )}
                          {status.kind === "locked" && (
                            <span className="text-rose-600 dark:text-rose-400">No attempts left — trainer notified</span>
                          )}
                          {status.kind === "in-progress" && (
                            <span className="text-sky-600 dark:text-sky-400">Quiz in progress</span>
                          )}
                          {status.kind === "not-started" && <span className="text-primary">Available now</span>}
                        </div>
                        <Button asChild variant={status.kind === "passed" || status.kind === "locked" ? "outline" : "default"} size="sm">
                          <Link href={`/manager/modules/${m.slug}`}>
                            {status.kind === "passed" ? "Review" : status.kind === "retake" ? "Retake" : status.kind === "locked" ? "View" : "Open"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

      <AnimatePresence>
        {filtered.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 text-muted-foreground"
          >
            No modules match &ldquo;{query}&rdquo;.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
