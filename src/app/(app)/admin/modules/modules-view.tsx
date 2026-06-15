"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, Users, Trophy, List, LayoutGrid, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddModuleSheet } from "@/components/admin/add-module-sheet";
import { Stagger, StaggerItem, CountUp } from "@/components/shared/animations";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModuleDef, Attempt, Teacher } from "@/types";
import type { Resource } from "@/lib/db/resources";

export interface AdminModulesViewProps {
  modules: ModuleDef[];
  attempts: Attempt[];
  teacherNamesById: Record<string, string>;
  teachers: Teacher[];
  defaultNumber: number;
  allSops?: Resource[];
}

type View = "list" | "cards";
const VIEW_KEY = "bcj.modulesView";

export function AdminModulesView({ modules, attempts, teacherNamesById, teachers, defaultNumber, allSops = [] }: AdminModulesViewProps) {
  // Default to the list view; remember the user's choice between visits.
  const [view, setView] = React.useState<View>("list");
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_KEY) : null;
    if (saved === "list" || saved === "cards") setView(saved);
  }, []);
  function changeView(v: View) {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }

  // Free-text search across the visible module fields (title, description,
  // M-number, month, status, owners).
  const [query, setQuery] = React.useState("");

  // Derive each module's display values once, reused by both views.
  const rows = modules.map((m) => {
    const ownerNames = m.ownerTeacherIds.map((id) => teacherNamesById[id]).filter(Boolean) as string[];
    const att = attempts.filter((a) => a.moduleSlug === m.slug);
    const passed = att.filter((a) => a.status === "passed").length;
    const passRate = att.length ? Math.round((passed / att.length) * 100) : 0;
    return { m, ownerNames, attempts: att.length, passRate };
  });

  const q = query.trim().toLowerCase();
  const filteredRows = q
    ? rows.filter(({ m, ownerNames }) =>
        [`m${m.number}`, m.title, m.description, m.scheduledMonth, m.status, ownerNames.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : rows;

  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="All Modules"
        description="The Manager training program. Click any to see results, content, and attempts."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={changeView} />
            <AddModuleSheet teachers={teachers} defaultNumber={defaultNumber} allSops={allSops} />
          </div>
        }
      />

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules by title, owner, month…"
          className="pl-9 h-9"
        />
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No modules match &ldquo;{query}&rdquo;.
        </div>
      ) : view === "cards" ? (
        <Stagger className="grid lg:grid-cols-2 gap-4">
          {filteredRows.map(({ m, ownerNames, attempts: attCount, passRate }) => (
            <StaggerItem key={m.slug} className="h-full">
              <Link href={`/admin/modules/${m.slug}`} className="block group h-full">
                <Card className="card-lift card-glow group-hover:border-primary/40 h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-xs font-mono text-muted-foreground">M{m.number} · {m.scheduledDate ? fmtDate(m.scheduledDate) : m.scheduledMonth}</div>
                      <StatusBadge variant={m.status} />
                    </div>
                    <div className="font-semibold text-lg">{m.title}</div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <Stat icon={Calendar} label="Day" value={m.scheduledDate ? fmtDate(m.scheduledDate, "MMM d") : "—"} animate={false} />
                      <Stat icon={Users} label="Attempts" value={String(attCount)} animate />
                      <Stat icon={Trophy} label="Pass rate" value={attCount ? `${passRate}%` : "—"} animate={attCount > 0} suffix="%" rawNumber={passRate} />
                    </div>

                    <div className="mt-auto pt-4 flex items-center justify-between text-xs">
                      <div className="text-muted-foreground">
                        {ownerNames.length > 1 ? "Co-owned by" : "Owned by"}{" "}
                        <span className="text-foreground font-medium">{ownerNames.join(", ") || "—"}</span>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Stagger className="space-y-2.5">
          {filteredRows.map(({ m, ownerNames, attempts: attCount, passRate }) => (
            <StaggerItem key={m.slug}>
              <Link href={`/admin/modules/${m.slug}`} className="block group">
                <Card className="card-lift group-hover:border-primary/40">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="text-xs font-mono text-muted-foreground w-24 shrink-0 leading-tight">
                      <div className="text-foreground font-semibold">M{m.number}</div>
                      <div>{m.scheduledDate ? fmtDate(m.scheduledDate) : m.scheduledMonth}</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{m.title}</span>
                        <StatusBadge variant={m.status} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{m.description}</p>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
                      <RowStat icon={Calendar} label="Day" value={m.scheduledDate ? fmtDate(m.scheduledDate, "MMM d") : "—"} />
                      <RowStat icon={Users} label="Attempts" value={String(attCount)} />
                      <RowStat icon={Trophy} label="Pass rate" value={attCount ? `${passRate}%` : "—"} />
                    </div>

                    <div className="hidden xl:block w-36 shrink-0 text-xs text-muted-foreground truncate">
                      {ownerNames.length > 1 ? "Co-owned by " : "Owned by "}
                      <span className="text-foreground font-medium">{ownerNames.join(", ") || "—"}</span>
                    </div>

                    <ArrowRight className="size-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {([
        { id: "list" as const, icon: List, label: "List view" },
        { id: "cards" as const, icon: LayoutGrid, label: "Card view" },
      ]).map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={label}
          aria-pressed={view === id}
          className={cn(
            "flex items-center justify-center size-8 rounded transition-colors",
            view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function RowStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground justify-end">
        <Icon className="size-3" /> {label}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  animate,
  rawNumber,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  animate?: boolean;
  rawNumber?: number;
  suffix?: string;
}) {
  const numeric = rawNumber !== undefined ? rawNumber : Number(value.replace(/[^\d.-]/g, ""));
  const showCountUp = animate && Number.isFinite(numeric);
  return (
    <div className="rounded-md border p-2.5 transition-colors hover:bg-accent/30">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <Icon className="size-3" /> {label}
      </div>
      <div className="font-semibold tabular-nums">
        {showCountUp ? <CountUp value={numeric} suffix={suffix ?? ""} /> : value}
      </div>
    </div>
  );
}
