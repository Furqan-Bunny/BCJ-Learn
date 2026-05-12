"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, PresentationIcon, Edit3, ListChecks, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddModuleSheet } from "@/components/admin/add-module-sheet";
import { fmtDate } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import type { ModuleDef, Teacher } from "@/types";

function totalMinutes(m: ModuleDef): number {
  return m.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
}

export interface TeacherModulesViewProps {
  me: { id: string };
  myModules: ModuleDef[];
  otherModules: ModuleDef[];
  teachers: Teacher[];
  defaultNumber: number;
}

export function TeacherModulesView({ me, myModules, otherModules, teachers, defaultNumber }: TeacherModulesViewProps) {
  return (
    <>
      <PageHeader
        eyebrow="My library"
        title="Your modules"
        description="Modules you own. Edit content, approve questions, see results."
        actions={<AddModuleSheet teachers={teachers} defaultNumber={defaultNumber} lockedOwnerId={me.id} />}
      />

      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        You own ({myModules.length})
      </h3>
      <Stagger className="grid lg:grid-cols-2 gap-4 mb-10">
        {myModules.map((m) => (
          <StaggerItem key={m.slug}>
            <ModuleCard m={m} ownerView />
          </StaggerItem>
        ))}
      </Stagger>

      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Other modules in the program
      </h3>
      <Stagger className="grid lg:grid-cols-2 gap-4" delay={0.1}>
        {otherModules.map((m) => (
          <StaggerItem key={m.slug}>
            <ModuleCard m={m} />
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}

function ModuleCard({ m, ownerView }: { m: ModuleDef; ownerView?: boolean }) {
  return (
    <Card className={`card-lift card-glow ${ownerView ? "border-primary/30" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-xs font-mono text-muted-foreground">
            M{m.number}
            {m.scheduledDate ? ` · ${fmtDate(m.scheduledDate, "MMM yyyy")}` : ""}
            {" · "}{totalMinutes(m)} min
          </div>
          <StatusBadge variant={m.status} />
        </div>
        <div className="font-semibold text-lg">{m.title}</div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="font-mono">{m.questionsApproved}/{m.questionsTotal}</span> questions approved
          {m.questionsApproved < m.questionsTotal && (
            <span className="ml-2 inline-flex items-center gap-1 text-[var(--gold)]">
              <Sparkles className="size-3" /> AI ready
            </span>
          )}
        </div>

        {ownerView ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild size="sm" className="col-span-2">
              <Link href={`/teacher/modules/${m.slug}/present`}>
                <PresentationIcon className="mr-1.5 size-3.5" /> Present in seminar
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/modules/${m.slug}/content`}>
                <Edit3 className="mr-1.5 size-3.5" /> Content
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/modules/${m.slug}/questions`}>
                <ListChecks className="mr-1.5 size-3.5" /> Questions
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="col-span-2">
              <Link href={`/teacher/modules/${m.slug}/results`}>
                <BarChart3 className="mr-1.5 size-3.5" /> See results
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/teacher/modules/${m.slug}`}>
                Open <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
