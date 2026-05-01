"use client";

import * as React from "react";
import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Layers, PlayCircle, ListChecks, BarChart3, Link2, BookOpen, PresentationIcon, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ModuleRoster } from "@/components/shared/module-roster";
import { DeliveryHistory } from "@/components/shared/delivery-history";
import { ScheduleRedelivery } from "@/components/admin/schedule-redelivery";
import { moduleBySlug, moduleContentCounts, moduleTotalMinutes } from "@/data/modules";
import { attemptsForModule } from "@/data/attempts";
import { fmtDate } from "@/lib/format";

export default function TeacherModuleOverview(props: PageProps<"/teacher/modules/[slug]">) {
  const { slug } = use(props.params);
  const mod = moduleBySlug(slug);
  if (!mod) return notFound();

  const attempts = attemptsForModule(slug);
  const passRate = attempts.length
    ? Math.round((attempts.filter((a) => a.status === "passed").length / attempts.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledMonth}`}
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
            <div className="text-2xl font-bold tabular-nums mt-2">{attempts.length}</div>
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
              <span className="font-semibold">{moduleTotalMinutes(slug)} minutes</span>
              <span className="text-muted-foreground"> · {mod.lessons.length} lessons</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/teacher/modules/${slug}/content`}>
                  <BookOpen className="mr-2 size-3.5" /> Edit content
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
        <ContentTile icon={PlayCircle} count={moduleContentCounts(slug).videos} label="Videos" />
        <ContentTile icon={FileText}   count={moduleContentCounts(slug).documents} label="Documents" />
        <ContentTile icon={Layers}     count={moduleContentCounts(slug).slides} label="Slide decks" />
        <ContentTile icon={Link2}      count={moduleContentCounts(slug).links} label="External links" />
      </div>

      {/* Roster — who's expected, who took the quiz, who didn't */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              Current roster
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Who's expected for the current delivery · status updates as quiz attempts come in
            </p>
          </div>
          <ScheduleRedelivery moduleSlug={slug} />
        </div>
        <ModuleRoster moduleSlug={slug} />
      </div>

      {/* Delivery history — past deliveries with their participants and results */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold tracking-tight mb-3">
          Past deliveries
        </h3>
        <DeliveryHistory moduleSlug={slug} />
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
        Training day: <span className="font-medium text-foreground">{fmtDate(mod.scheduledDate)}</span>
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
