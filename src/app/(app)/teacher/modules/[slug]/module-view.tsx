"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, Layers, PlayCircle, ListChecks, BarChart3, Link2, BookOpen, PresentationIcon, Users, GraduationCap, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ModuleRoster, type AddableManager } from "@/components/shared/module-roster";
import { DeliveryHistory } from "@/components/shared/delivery-history";
import { ScheduleRedelivery } from "@/components/admin/schedule-redelivery";
import { RescheduleSeminar } from "@/components/admin/reschedule-seminar";
import { fmtDate } from "@/lib/format";
import type { ModuleDef, Attempt, Manager } from "@/types";
import type { RosterRow, RosterCounts } from "@/lib/db/roster";
import type { DeliveryRecord } from "@/lib/db/deliveries";

export interface TeacherModuleViewProps {
  mod: ModuleDef;
  attempts: Attempt[];
  roster: RosterRow[];
  counts: RosterCounts;
  deliveries: DeliveryRecord[];
  managersById: Record<string, Pick<Manager, "id" | "name" | "avatarColor" | "cohort">>;
  currentDeliveryStart: string | null;
  addableManagers?: AddableManager[];
}

export function TeacherModuleView({
  mod,
  attempts,
  roster,
  counts: rosterCounts,
  deliveries,
  managersById,
  currentDeliveryStart,
  addableManagers = [],
}: TeacherModuleViewProps) {
  const slug = mod.slug;
  const totalMinutes = mod.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
  const allContents = mod.lessons.flatMap((l) => l.contents);
  const counts = {
    videos: allContents.filter((c) => c.type === "video").length,
    documents: allContents.filter((c) => c.type === "document").length,
    slides: allContents.filter((c) => c.type === "slides").length,
    links: allContents.filter((c) => c.type === "link").length,
  };

  // Only submitted attempts (passed/failed) are real attempts — scheduled
  // retakes and abandoned in-progress rows must not inflate the count or rate.
  const submittedAttempts = attempts.filter((a) => a.status === "passed" || a.status === "failed");
  const passRate = submittedAttempts.length
    ? Math.round((submittedAttempts.filter((a) => a.status === "passed").length / submittedAttempts.length) * 100)
    : 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/teacher/modules"><ArrowLeft className="size-4 mr-1" /> All Modules</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledDate ? fmtDate(mod.scheduledDate) : mod.scheduledMonth}`}
        title={mod.title}
        description={mod.description}
        actions={<StatusBadge variant={mod.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Question bank</div>
            <div className="text-2xl font-bold tabular-nums mt-2">
              {mod.questionsApproved} <span className="text-muted-foreground text-base font-normal">/ {mod.questionsTotal}</span>
            </div>
            <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
              <Link href={`/teacher/modules/${slug}/questions`}>Review <ArrowRight className="ml-1 size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Attempts</div>
            <div className="text-2xl font-bold tabular-nums mt-2">{submittedAttempts.length}</div>
            <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
              <Link href={`/teacher/modules/${slug}/results`}>See results <ArrowRight className="ml-1 size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pass rate</div>
            <div className="text-2xl font-bold tabular-nums mt-2 text-emerald-600 dark:text-emerald-400">{passRate || "—"}{passRate ? "%" : ""}</div>
            <div className="text-xs text-muted-foreground mt-3">Threshold: {Math.round(mod.passThreshold * 100)}%</div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold tracking-tight mb-4">Seminar plan</h3>
      <Card className="mb-4 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div className="text-sm">
              <span className="font-semibold">{totalMinutes} minutes</span>
              <span className="text-muted-foreground"> · {mod.lessons.length} lessons</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/teacher/modules/${slug}/content`}>
                  <BookOpen className="mr-2 size-3.5" /> Edit content
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/manager/modules/${slug}`}>
                  <GraduationCap className="mr-2 size-3.5" /> Take it yourself
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/teacher/modules/${slug}/present?preview=1`}>
                  <Eye className="mr-2 size-3.5" /> Preview
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/teacher/modules/${slug}/present`}>
                  <PresentationIcon className="mr-2 size-3.5" /> Present
                </Link>
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {mod.lessons.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card">
                <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold">
                  L{l.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{l.contents.length} content items · {l.durationMinutes} min</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold tracking-tight mb-4 mt-8">Content tally</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ContentTile icon={PlayCircle} count={counts.videos} label="Videos" />
        <ContentTile icon={FileText}   count={counts.documents} label="Documents" />
        <ContentTile icon={Layers}     count={counts.slides} label="Slide decks" />
        <ContentTile icon={Link2}      count={counts.links} label="External links" />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              Current roster
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Who&rsquo;s expected for the current delivery · status updates as quiz attempts come in
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentDeliveryStart && (
              <RescheduleSeminar
                moduleSlug={slug}
                moduleTitle={mod.title}
                attendeeCount={rosterCounts.expected}
                moduleDate={mod.scheduledDate}
                moduleTime={mod.scheduledTime}
                moduleTz={mod.timezone}
              />
            )}
            <ScheduleRedelivery
              moduleSlug={slug}
              moduleTitle={mod.title}
              currentDeliveryStart={currentDeliveryStart}
              moduleDate={mod.scheduledDate}
              moduleTime={mod.scheduledTime}
              moduleTz={mod.timezone}
              checkedInCount={rosterCounts.checkedIn}
            />
          </div>
        </div>
        <ModuleRoster moduleSlug={slug} roster={roster} counts={rosterCounts} manageable addableManagers={addableManagers} />
      </div>

      <div className="mt-10">
        <h3 className="text-lg font-semibold tracking-tight mb-3">Past deliveries</h3>
        <DeliveryHistory
          moduleSlug={slug}
          deliveries={deliveries}
          managersById={managersById}
          attempts={attempts}
        />
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <Link href={`/teacher/modules/${slug}/questions`}>
          <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ListChecks className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Review &amp; approve questions</div>
                <p className="text-sm text-muted-foreground mt-1">Approve, edit, regenerate, or reject AI-drafted questions before they go live.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/teacher/modules/${slug}/results`}>
          <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Module results</div>
                <p className="text-sm text-muted-foreground mt-1">See score distribution, pass rate, and which questions are missed most.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-8 text-xs text-muted-foreground">
        Training day:{" "}
        <span className="font-medium text-foreground">
          {mod.scheduledDate ? fmtDate(mod.scheduledDate) : "Not scheduled yet"}
        </span>
      </div>
    </>
  );
}

function ContentTile({ icon: Icon, count, label }: { icon: React.ComponentType<{ className?: string }>; count: number; label: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-xl font-bold tabular-nums">{count}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
