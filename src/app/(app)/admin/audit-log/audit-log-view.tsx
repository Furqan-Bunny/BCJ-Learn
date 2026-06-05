"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, X, Sparkles, Users, Bell, FileText, AlertTriangle, Search, RotateCcw, UserCheck, Play, Square, LogIn, ArrowDownUp, FilterX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, pageSlice } from "@/components/ui/pagination";
import { fmtRelative, fmtDate, initials } from "@/lib/format";
import { SearchLoadingBar, motion, AnimatePresence } from "@/components/shared/animations";
import type { ActivityEvent, ActivityKind } from "@/types";

const kindLabel = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ICONS = {
  quiz_passed: { Icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  quiz_failed: { Icon: X, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400" },
  retake_scheduled: { Icon: Sparkles, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400" },
  module_published: { Icon: Sparkles, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  module_assigned: { Icon: Sparkles, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  user_added: { Icon: Users, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  user_deactivated: { Icon: X, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400" },
  reminder_sent: { Icon: Bell, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  report_exported: { Icon: FileText, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  questions_approved: { Icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  manager_flagged: { Icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  delivery_rescheduled: { Icon: RotateCcw, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400" },
  manager_checked_in: { Icon: UserCheck, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  session_started: { Icon: Play, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  session_ended: { Icon: Square, bg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  user_login: { Icon: LogIn, bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300" },
  resource_updated: { Icon: FileText, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
} as const;

export interface AuditLogViewProps {
  events: ActivityEvent[];
  actorsById: Record<string, { id: string; name: string; avatarColor: string; avatarUrl?: string | null }>;
}

const PER_PAGE = 25;

export function AuditLogView({ events, actorsById }: AuditLogViewProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<ActivityKind | "all">("all");
  const [actorFilter, setActorFilter] = React.useState<string>("all");
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");
  const [page, setPage] = React.useState(0);

  // Only offer types + people that actually appear in the log.
  const kindsPresent = React.useMemo(
    () => Array.from(new Set(events.map((e) => e.kind))).sort(),
    [events],
  );
  const actorsPresent = React.useMemo(() => {
    const ids = Array.from(new Set(events.map((e) => e.actorId).filter(Boolean)));
    return ids
      .map((id) => actorsById[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [events, actorsById]);

  const filtered = React.useMemo(() => {
    const out = events.filter((e) => {
      if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && e.kind !== typeFilter) return false;
      if (actorFilter !== "all" && e.actorId !== actorFilter) return false;
      return true;
    });
    out.sort((a, b) => {
      const d = +new Date(b.occurredAt) - +new Date(a.occurredAt);
      return sort === "newest" ? d : -d;
    });
    return out;
  }, [events, search, typeFilter, actorFilter, sort]);

  // Reset to the first page whenever the filters narrow the set.
  React.useEffect(() => { setPage(0); }, [search, typeFilter, actorFilter, sort]);
  const shown = pageSlice(filtered, page, PER_PAGE);

  const hasFilters = !!search || typeFilter !== "all" || actorFilter !== "all";
  function clearFilters() {
    setSearch(""); setTypeFilter("all"); setActorFilter("all"); setSort("newest");
  }

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Audit log"
        description="Every event in BCJ Learn — who did what, when. Searchable and filterable."
      />

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${search ? "text-primary" : "text-muted-foreground"}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="pl-9 h-9 transition-shadow focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
          />
          <SearchLoadingBar active={!!search} />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ActivityKind | "all")}>
          <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {kindsPresent.map((k) => <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={actorFilter} onValueChange={(v) => setActorFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="Anyone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {actorsPresent.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "oldest")}>
          <SelectTrigger className="h-9 w-full sm:w-36">
            <ArrowDownUp className="size-3.5 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 shrink-0 text-muted-foreground">
            <FilterX className="size-4 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <Search className="size-8 mx-auto mb-3 opacity-30" />
              No events match these filters.
            </div>
          ) : (
          <ul className="divide-y">
            <AnimatePresence initial mode="popLayout">
              {shown.map((e, idx) => {
                const meta = ICONS[e.kind] ?? ICONS.quiz_passed;
                const actor = actorsById[e.actorId];
                return (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.025, 0.4), ease: [0.16, 1, 0.3, 1] }}
                    className="px-4 sm:px-5 py-3.5 flex items-start gap-3 sm:gap-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className={`size-9 rounded-md ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <meta.Icon className={`size-4 ${meta.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm break-words">{e.message}</div>
                      {/* Meta wraps on small screens instead of crowding into a fixed right column. */}
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge variant="outline" className="text-[10px] capitalize">{e.kind.replace(/_/g, " ")}</Badge>
                        <span className="whitespace-nowrap">{fmtDate(e.occurredAt, "MMM d, h:mm a")}</span>
                        {actor && (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Avatar className="size-5 border shrink-0">
                              <AvatarImage src={actor.avatarUrl ?? undefined} alt={actor.name} className="object-cover" />
                              <AvatarFallback style={{ background: actor.avatarColor, color: "white" }} className="text-[9px]">
                                {initials(actor.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{actor.name}</span>
                          </span>
                        )}
                        <span className="tabular-nums whitespace-nowrap">· {fmtRelative(e.occurredAt)}</span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} total={filtered.length} pageSize={PER_PAGE} onPageChange={setPage} className="mt-4" />
    </>
  );
}
