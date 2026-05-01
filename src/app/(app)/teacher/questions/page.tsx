"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Sparkles, ArrowRight, Filter, X as XIcon, ListChecks, BookOpen, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { questions } from "@/data/questions";
import { modules } from "@/data/modules";
import { teachers } from "@/data/users";
import type { QuestionStatus, QuestionPool } from "@/types";

const ALL = "all";

export default function TeacherQuestionLibrary() {
  // Demo: Nancy
  const me = teachers[0];
  const myModuleSlugs = new Set(me.ownedModuleSlugs);
  const myModules = modules.filter((m) => myModuleSlugs.has(m.slug));
  const myQuestions = questions.filter((q) => myModuleSlugs.has(q.moduleSlug));

  const [moduleSlug, setModuleSlug] = React.useState<string>(ALL);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<QuestionStatus | "all">("all");
  const [pool, setPool] = React.useState<QuestionPool | "all">("all");

  const countsByModule = React.useMemo(() => {
    const m: Record<string, { total: number; approved: number; pending: number }> = {
      [ALL]: { total: 0, approved: 0, pending: 0 },
    };
    for (const mod of myModules) m[mod.slug] = { total: 0, approved: 0, pending: 0 };
    for (const q of myQuestions) {
      m[q.moduleSlug].total++;
      m[ALL].total++;
      if (q.status === "approved") { m[q.moduleSlug].approved++; m[ALL].approved++; }
      if (q.status === "pending")  { m[q.moduleSlug].pending++;  m[ALL].pending++; }
    }
    return m;
  }, [myModules, myQuestions]);

  const filtered = React.useMemo(() => {
    return myQuestions.filter((q) => {
      if (moduleSlug !== ALL && q.moduleSlug !== moduleSlug) return false;
      if (status !== "all" && q.status !== status) return false;
      if (pool !== "all" && q.pool !== pool) return false;
      if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [myQuestions, moduleSlug, status, pool, search]);

  const activeModule = modules.find((m) => m.slug === moduleSlug);
  const filtersActive = moduleSlug !== ALL || status !== "all" || pool !== "all" || search !== "";

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Your question library"
        description={`AI-drafted + approved questions across ${myModules.length === 1 ? "the module you own" : "your modules"}. Pick a module to drill in, or open a module to review pending questions.`}
      />

      {/* Module selector */}
      {myModules.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <BookOpen className="size-3.5" /> Filter by module
          </div>
          <div className="flex flex-wrap gap-2">
            <ModuleChip
              active={moduleSlug === ALL}
              onClick={() => setModuleSlug(ALL)}
              label={myModules.length === 1 ? "All" : "All my modules"}
              count={countsByModule[ALL]?.total ?? 0}
              approved={countsByModule[ALL]?.approved ?? 0}
            />
            {myModules.map((m) => {
              const c = countsByModule[m.slug];
              return (
                <ModuleChip
                  key={m.slug}
                  active={moduleSlug === m.slug}
                  onClick={() => setModuleSlug(m.slug)}
                  label={`M${m.number} · ${m.title}`}
                  count={c?.total ?? 0}
                  approved={c?.approved ?? 0}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Active module summary */}
      {activeModule && (
        <Card className="mb-6 bg-primary/[0.03] border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  M{activeModule.number}
                </div>
                <div>
                  <div className="font-semibold text-lg">{activeModule.title}</div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{activeModule.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{activeModule.scheduledMonth}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <StatusBadge variant={activeModule.status} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/modules/${activeModule.slug}/questions`}>
                    Open question editor <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniStat label="Total" value={countsByModule[activeModule.slug]?.total ?? 0} icon={ListChecks} />
              <MiniStat label="Approved" value={countsByModule[activeModule.slug]?.approved ?? 0} icon={CheckCircle2} tone="success" />
              <MiniStat label="Pending review" value={countsByModule[activeModule.slug]?.pending ?? 0} icon={Sparkles} tone="warn" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text…"
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={pool} onValueChange={(v) => setPool(v as QuestionPool | "all")}>
          <TabsList>
            <TabsTrigger value="all">All pools</TabsTrigger>
            <TabsTrigger value="first-attempt">First attempt</TabsTrigger>
            <TabsTrigger value="retake">Retake</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={status} onValueChange={(v) => setStatus(v as QuestionStatus | "all")}>
          <TabsList>
            <TabsTrigger value="all">Any status</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setModuleSlug(ALL);
              setSearch("");
              setStatus("all");
              setPool("all");
            }}
          >
            <XIcon className="size-3.5 mr-1" /> Reset
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          <Filter className="size-3 inline mr-1" />
          {filtered.length} of {myQuestions.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            <Filter className="size-8 mx-auto mb-3 opacity-40" />
            <div className="font-medium text-foreground">No questions match your filters</div>
            <div className="text-sm mt-1">Try clearing filters or picking a different module.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 50).map((q, i) => {
            const mod = modules.find((m) => m.slug === q.moduleSlug);
            return (
              <Card key={q.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 mt-1 w-8 text-right">
                    {String(i + 1).padStart(3, "0")}
                  </div>
                  <Sparkles className="size-4 text-[var(--ai)] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-2">{q.text}</div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <StatusBadge variant={q.status} />
                      <StatusBadge variant={q.pool} />
                      <Badge variant="outline" className="font-mono text-[10px]">
                        M{mod?.number} · {mod?.title}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Miss rate: <span className="font-mono font-semibold text-rose-600">{Math.round(q.missRate * 100)}%</span>
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/teacher/modules/${q.moduleSlug}/questions`}>
                      Review <ArrowRight className="ml-1 size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length > 50 && (
            <div className="mt-4 text-xs text-muted-foreground text-center py-3 border rounded-lg bg-muted/30">
              Showing first 50 of {filtered.length} matching questions. Refine your filters to narrow down.
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ModuleChip({
  active, onClick, label, count, approved,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  approved?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card hover:bg-accent border-border text-foreground/80 hover:text-foreground",
      ].join(" ")}
    >
      <span>{label}</span>
      <Badge
        variant="secondary"
        className={[
          "ml-1 font-mono tabular-nums",
          active ? "bg-primary-foreground/15 text-primary-foreground border-transparent" : "",
        ].join(" ")}
      >
        {approved !== undefined ? `${approved}/${count}` : count}
      </Badge>
    </button>
  );
}

function MiniStat({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warn";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn"    ? "text-amber-600 dark:text-amber-400" :
    "text-foreground";
  return (
    <div className="rounded-md border bg-card p-3 flex items-center gap-3">
      <div className={`size-9 rounded-md bg-muted flex items-center justify-center ${toneClass}`}>
        <Icon className="size-4" />
      </div>
      <div>
        <div className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
