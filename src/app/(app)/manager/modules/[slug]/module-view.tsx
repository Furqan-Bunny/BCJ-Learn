"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Target, Clock, Layers, PlayCircle, FileText, Link2,
  BookOpen, Sparkles, Info,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { QuizStatusCard } from "@/components/manager/quiz-status-card";
import { ContentViewer } from "@/components/manager/content-viewer";
import { fmtDate } from "@/lib/format";
import type { ContentType, LessonContent, ModuleDef, Attempt } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ContentType, { icon: React.ComponentType<{ className?: string }>; label: string; tint: string }> = {
  video:    { icon: PlayCircle, label: "Video",    tint: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/40" },
  document: { icon: FileText,   label: "Document", tint: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/40" },
  slides:   { icon: Layers,     label: "Slides",   tint: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40" },
  link:     { icon: Link2,      label: "Link",     tint: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/40" },
};

export interface ManagerModuleViewProps {
  mod: ModuleDef;
  totalMinutes: number;
  teacher: { id: string; name: string; bio: string } | null;
  managerId: string;
  myAttempts: Attempt[];
  isCheckedIn: boolean;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
}

export function ManagerModuleView({
  mod,
  totalMinutes,
  teacher,
  managerId,
  myAttempts,
  isCheckedIn,
  sessionStartedAt,
  sessionEndedAt,
}: ManagerModuleViewProps) {
  const [previewing, setPreviewing] = React.useState<LessonContent | null>(null);

  return (
    <>
      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledMonth}`}
        title={mod.title}
        description={mod.description}
      />

      <div className="mb-6">
        <QuizStatusCard
          managerId={managerId}
          mod={mod}
          myAttempts={myAttempts}
          isCheckedIn={isCheckedIn}
          sessionStartedAt={sessionStartedAt}
          sessionEndedAt={sessionEndedAt}
          variant="full"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Calendar} label="Training day" value={mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—"} />
        <StatCard icon={Clock} label="Total length" value={`${totalMinutes} min`} sub={`${mod.lessons.length} lessons`} />
        <StatCard icon={Target} label="Pass at" value={`${Math.round(mod.passThreshold * 100)}%`} />
        <StatCard icon={Layers} label="Quiz" value={`${mod.questionCount} questions`} sub={mod.timeLimitMinutes ? `${mod.timeLimitMinutes} min limit` : "Untimed"} />
      </div>

      <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-foreground">How this works.</span>
            <span className="text-muted-foreground"> This module is delivered as a <span className="font-medium text-foreground">{totalMinutes}-minute live in-person session</span> by {teacher?.name ?? "your trainer"}, broken into <span className="font-medium text-foreground">{mod.lessons.length} lessons</span>. Materials below are reference — you don&rsquo;t need to complete them to take the quiz. Show up to the room, listen, then take the quiz right after.</span>
          </div>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold tracking-tight mb-3">Seminar outline</h3>
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
                  {lesson.contents.map((item) => {
                    const meta = TYPE_META[item.type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setPreviewing(item)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all text-left group"
                      >
                        <div className={cn("size-7 rounded flex items-center justify-center shrink-0", meta.tint)}>
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{meta.label}</span>
                            {item.durationMinutes && (
                              <>
                                <span className="text-muted-foreground/50">·</span>
                                <span>{item.durationMinutes} min</span>
                              </>
                            )}
                            {item.fileName && (
                              <>
                                <span className="text-muted-foreground/50">·</span>
                                <span className="truncate">{item.fileName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors">
                          {item.type === "link" ? "Open ↗" : "Preview"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {mod.flashcards && mod.flashcards.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold tracking-tight">Optional self-study</h3>
            <Badge variant="secondary" className="text-[10px]">
              <Sparkles className="size-3 mr-1 text-[var(--ai)]" />
              {mod.flashcards.length} flashcards
            </Badge>
          </div>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                Quick recall cards if you want to review key facts before the seminar. AI-generated from the module content.
              </p>
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {mod.flashcards.slice(0, 4).map((f, i) => (
                  <div key={i} className="rounded-md border p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground">{f.front}</div>
                    <div className="text-sm font-medium mt-1">{f.back}</div>
                  </div>
                ))}
              </div>
              {mod.flashcards.length > 4 && (
                <Button variant="ghost" size="sm" className="mt-3 -ml-2">
                  See all {mod.flashcards.length} flashcards →
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="mt-10 pt-6 border-t flex items-center gap-3 text-sm">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          This module is taught by <span className="font-medium text-foreground">{teacher?.name ?? "—"}</span>
          {teacher?.bio && ` · ${teacher.bio}`}
        </span>
      </div>

      <ContentViewer content={previewing} onClose={() => setPreviewing(null)} />
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex items-center justify-center size-9 rounded-md bg-primary/10 text-primary shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-semibold tabular-nums truncate">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
