"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, PresentationIcon, Edit3, ListChecks, BarChart3, GraduationCap } from "lucide-react";
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
  /** Slugs this lead owns — owned modules get the full edit controls. */
  ownedSlugs: string[];
  teachers: Teacher[];
  defaultNumber: number;
}

export function TeacherModulesView({ me, myModules, ownedSlugs, teachers, defaultNumber }: TeacherModulesViewProps) {
  const owned = new Set(ownedSlugs);
  // Owned first, then the rest — both alphabetised by module number.
  const sorted = [...myModules].sort((a, b) => {
    const ao = owned.has(a.slug) ? 0 : 1;
    const bo = owned.has(b.slug) ? 0 : 1;
    return ao - bo || a.number - b.number;
  });

  return (
    <>
      <PageHeader
        eyebrow="My library"
        title="Modules"
        description="Every module — take any quiz yourself. Present, edit, and see results on the modules assigned to you."
        actions={<AddModuleSheet teachers={teachers} defaultNumber={defaultNumber} lockedOwnerId={me.id} />}
      />

      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        All modules ({sorted.length})
      </h3>
      {sorted.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          No modules yet. Create one to get started.
        </div>
      ) : (
        <Stagger className="grid lg:grid-cols-2 gap-4">
          {sorted.map((m) => (
            <StaggerItem key={m.slug} className="h-full">
              <ModuleCard m={m} owns={owned.has(m.slug)} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}

function ModuleCard({ m, owns }: { m: ModuleDef; owns: boolean }) {
  return (
    <Card className={`card-lift card-glow h-full flex flex-col ${owns ? "border-primary/30" : ""}`}>
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-xs font-mono text-muted-foreground">
            M{m.number}
            {m.scheduledDate ? ` · ${fmtDate(m.scheduledDate, "MMM yyyy")}` : ""}
            {" · "}{totalMinutes(m)} min
          </div>
          <div className="flex items-center gap-1.5">
            {owns && <Badge variant="secondary" className="text-[10px]">Owner</Badge>}
            <StatusBadge variant={m.status} />
          </div>
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

        <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
          {/* Present is scoped to the modules a lead owns (admins present any). */}
          {owns && (
            <Button asChild size="sm" className="col-span-2">
              <Link href={`/teacher/modules/${m.slug}/present`}>
                <PresentationIcon className="mr-1.5 size-3.5" /> Present in seminar
              </Link>
            </Button>
          )}
          {/* Take the module yourself — content, check-in and the quiz, like a manager.
              Available for every module. */}
          <Button asChild variant="outline" size="sm" className="col-span-2">
            <Link href={`/manager/modules/${m.slug}`}>
              <GraduationCap className="mr-1.5 size-3.5" /> Take it yourself
            </Link>
          </Button>
          {owns && (
            <>
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
