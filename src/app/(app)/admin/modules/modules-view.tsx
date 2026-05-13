"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, Users, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddModuleSheet } from "@/components/admin/add-module-sheet";
import { Stagger, StaggerItem, CountUp } from "@/components/shared/animations";
import { fmtDate } from "@/lib/format";
import type { ModuleDef, Attempt } from "@/types";

import type { Teacher } from "@/types";

export interface AdminModulesViewProps {
  modules: ModuleDef[];
  attempts: Attempt[];
  teacherNamesById: Record<string, string>;
  teachers: Teacher[];
  defaultNumber: number;
}

export function AdminModulesView({ modules, attempts, teacherNamesById, teachers, defaultNumber }: AdminModulesViewProps) {
  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="All modules"
        description="The five-module Employee training program. Click any to see results, content, and attempts."
        actions={<AddModuleSheet teachers={teachers} defaultNumber={defaultNumber} />}
      />

      <Stagger className="grid lg:grid-cols-2 gap-4">
        {modules.map((m) => {
          const ownerNames = m.ownerTeacherIds
            .map((id) => teacherNamesById[id])
            .filter(Boolean) as string[];
          const att = attempts.filter((a) => a.moduleSlug === m.slug);
          const passed = att.filter((a) => a.status === "passed").length;
          const passRate = att.length ? Math.round((passed / att.length) * 100) : 0;

          return (
            <StaggerItem key={m.slug} className="h-full">
              <Link href={`/admin/modules/${m.slug}`} className="block group h-full">
                <Card className="card-lift card-glow group-hover:border-primary/40 h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-xs font-mono text-muted-foreground">M{m.number} · {m.scheduledMonth}</div>
                      <StatusBadge variant={m.status} />
                    </div>
                    <div className="font-semibold text-lg">{m.title}</div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <Stat icon={Calendar} label="Day" value={m.scheduledDate ? fmtDate(m.scheduledDate, "MMM d") : "—"} animate={false} />
                      <Stat icon={Users} label="Attempts" value={String(att.length)} animate />
                      <Stat icon={Trophy} label="Pass rate" value={att.length ? `${passRate}%` : "—"} animate={att.length > 0} suffix="%" rawNumber={passRate} />
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
          );
        })}
      </Stagger>
    </>
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
