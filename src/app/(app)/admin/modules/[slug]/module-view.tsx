"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, BookOpen, Calendar, Clock, Layers, Target, FileText, PlayCircle,
  Link2, ListChecks, BarChart3, Trophy, Users, AlertTriangle, PresentationIcon, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { ModuleRoster } from "@/components/shared/module-roster";
import { DeliveryHistory } from "@/components/shared/delivery-history";
import { ScheduleRedelivery } from "@/components/admin/schedule-redelivery";
import { fmtDate, initials } from "@/lib/format";
import type { ContentType, ModuleDef, Attempt, Question, Teacher, Manager } from "@/types";
import type { RosterRow, RosterCounts } from "@/lib/db/roster";
import type { DeliveryRecord } from "@/lib/db/deliveries";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ContentType, { icon: React.ComponentType<{ className?: string }>; label: string; tint: string }> = {
  video:    { icon: PlayCircle, label: "Video",    tint: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40" },
  document: { icon: FileText,   label: "Document", tint: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40" },
  slides:   { icon: Layers,     label: "Slides",   tint: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" },
  link:     { icon: Link2,      label: "Link",     tint: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40" },
};

export interface AdminModuleViewProps {
  mod: ModuleDef;
  moduleTeachers: Teacher[];
  attempts: Attempt[];
  questions: Question[];
  roster: RosterRow[];
  counts: RosterCounts;
  deliveries: DeliveryRecord[];
  managersById: Record<string, Pick<Manager, "id" | "name" | "avatarColor" | "cohort">>;
  currentDeliveryStart: string | null;
}

export function AdminModuleView({
  mod,
  moduleTeachers,
  attempts,
  questions,
  roster,
  counts: rosterCounts,
  deliveries,
  managersById,
  currentDeliveryStart,
}: AdminModuleViewProps) {
  const slug = mod.slug;
  const totalMinutes = mod.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
  const allContents = mod.lessons.flatMap((l) => l.contents);
  const contentCounts = {
    videos: allContents.filter((c) => c.type === "video").length,
    documents: allContents.filter((c) => c.type === "document").length,
    slides: allContents.filter((c) => c.type === "slides").length,
    links: allContents.filter((c) => c.type === "link").length,
    totalItems: allContents.length,
  };

  const currentDeliveryIdx = deliveries.find((d) => d.isCurrent)?.index ?? 1;
  const totalDeliveries = deliveries.length;

  const passed = attempts.filter((a) => a.status === "passed").length;
  const failed = attempts.filter((a) => a.status === "failed").length;
  const passRate = attempts.length ? Math.round((passed / attempts.length) * 100) : 0;
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + Number(a.scorePct), 0) / attempts.length)
    : 0;

  const approvedQs = questions.filter((q) => q.status === "approved").length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/modules"><ArrowLeft className="size-4 mr-1" /> All modules</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledMonth}${totalDeliveries > 1 ? ` · Delivery ${currentDeliveryIdx} of ${totalDeliveries}` : ""}`}
        title={mod.title}
        description={mod.description}
        actions={
          <div className="flex items-center gap-2">
            {totalDeliveries > 1 && (
              <Badge variant="secondary" className="font-mono">
                D{currentDeliveryIdx} / {totalDeliveries}
              </Badge>
            )}
            <StatusBadge variant={mod.status} />
            <Button asChild variant="outline">
              <Link href={`/teacher/modules/${slug}/content`}>
                <BookOpen className="mr-2 size-4" /> Edit content
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/teacher/modules/${slug}/present`}>
                <PresentationIcon className="mr-2 size-4" /> Open presenter
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Attempts" value={attempts.length} icon={Users} />
        <KpiCard label="Pass rate" value={attempts.length ? `${passRate}%` : "—"} icon={Trophy} accent="success" />
        <KpiCard label="Avg score" value={attempts.length ? `${avgScore}%` : "—"} icon={Target} />
        <KpiCard label="Failed attempts" value={failed} icon={AlertTriangle} accent="warning" />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold tracking-tight">Seminar plan</h3>
            <div className="text-xs text-muted-foreground">
              <Clock className="size-3 inline mr-1" />
              {totalMinutes} min · {mod.lessons.length} lessons · {contentCounts.totalItems} content items
            </div>
          </div>

          <div className="space-y-3">
            {mod.lessons.map((lesson) => (
              <Card key={lesson.id} className="overflow-hidden">
                <div className="grid grid-cols-[auto_1fr] gap-0">
                  <div className="bg-primary/5 border-r flex flex-col items-center justify-center p-5 min-w-[80px]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lesson</div>
                    <div className="text-3xl font-bold tabular-nums text-primary mt-1">{lesson.order}</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {lesson.durationMinutes} min
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="font-semibold text-base">{lesson.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>

                    <div className="mt-4 space-y-1.5">
                      {lesson.contents.map((c) => {
                        const meta = TYPE_META[c.type];
                        const Icon = meta.icon;
                        return (
                          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-md border bg-card">
                            <div className={cn("size-7 rounded flex items-center justify-center shrink-0", meta.tint)}>
                              <Icon className="size-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{c.title}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{meta.label}</span>
                                {c.durationMinutes && (
                                  <>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span>{c.durationMinutes} min</span>
                                  </>
                                )}
                                {c.fileName && (
                                  <>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span className="truncate">{c.fileName}</span>
                                  </>
                                )}
                                {c.fileSize && (
                                  <>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span>{c.fileSize}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Users className="size-5 text-muted-foreground" />
                  Current roster
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Who&rsquo;s expected for the current delivery
                </p>
              </div>
              <ScheduleRedelivery
                moduleSlug={slug}
                moduleTitle={mod.title}
                currentDeliveryStart={currentDeliveryStart}
                checkedInCount={rosterCounts.checkedIn}
                pendingCount={roster.filter((r) => r.status !== "passed").length}
              />
            </div>
            <ModuleRoster moduleSlug={slug} roster={roster} counts={rosterCounts} />
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

          <div className="mt-8 grid sm:grid-cols-3 gap-3">
            <Link href={`/teacher/modules/${slug}/questions`}>
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ListChecks className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">Question bank</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {approvedQs}/{questions.length} approved
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/teacher/modules/${slug}/results`}>
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BarChart3 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">Results dashboard</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Pass distribution + missed Qs</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/admin/results?module=${slug}`}>
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Trophy className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">All attempts</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{attempts.length} attempts logged</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Module {moduleTeachers.length > 1 ? "owners" : "owner"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleTeachers.map((t) => (
                <Link key={t.id} href="/admin/teachers" className="flex items-center gap-3 group">
                  <Avatar className="size-10 border">
                    <AvatarFallback style={{ background: t.avatarColor, color: "white" }} className="font-semibold">
                      {initials(t.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm group-hover:text-primary truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.email}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Field icon={Calendar} label="Training day" value={mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—"} />
              <Field icon={Clock} label="Total length" value={`${totalMinutes} min`} />
              <Field icon={Target} label="Pass threshold" value={`${Math.round(mod.passThreshold * 100)}%`} />
              <Field icon={Layers} label="Quiz length" value={`${mod.questionCount} questions${mod.timeLimitMinutes ? ` · ${mod.timeLimitMinutes} min limit` : ""}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Content tally</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <TallyRow icon={PlayCircle} label="Videos" count={contentCounts.videos} tint={TYPE_META.video.tint} />
              <TallyRow icon={FileText} label="Documents" count={contentCounts.documents} tint={TYPE_META.document.tint} />
              <TallyRow icon={Layers} label="Slide decks" count={contentCounts.slides} tint={TYPE_META.slides.tint} />
              <TallyRow icon={Link2} label="External links" count={contentCounts.links} tint={TYPE_META.link.tint} />
            </CardContent>
          </Card>

          <Card className="border-[var(--ai)]/30 bg-[var(--ai)]/5">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <Sparkles className="size-4 text-[var(--ai)] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">AI from content</div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Videos and documents are used as source material to draft the quiz question bank.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function TallyRow({ icon: Icon, label, count, tint }: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; tint: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-6 rounded flex items-center justify-center", tint)}>
        <Icon className="size-3" />
      </span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums font-semibold">{count}</span>
    </div>
  );
}
