"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { acknowledgeResource } from "@/lib/server/resource-actions";
import type { ModuleSopStatus } from "@/lib/db/module-resources";
import {
  Calendar, Target, Clock, Layers, PlayCircle, FileText, Link2,
  BookOpen, Sparkles, Info, Lock, CheckCircle2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { QuizStatusCard } from "@/components/manager/quiz-status-card";
import { CheckInCard } from "@/components/manager/check-in-card";
import { DeliveryLiveSync } from "@/components/manager/delivery-live-sync";
import { ContentViewer } from "@/components/manager/content-viewer";
import { fmtDate } from "@/lib/format";
import type { ContentType, LessonContent, ModuleDef, Attempt } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

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
  checkinOpen?: boolean;
  managerName?: string;
  moduleSops?: ModuleSopStatus[];
  /** Where the "All modules" link goes — staff land here via "Take it yourself". */
  backHref?: string;
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
  checkinOpen = false,
  managerName = "",
  moduleSops = [],
  backHref = "/manager/modules",
}: ManagerModuleViewProps) {
  const t = useT();
  const [previewing, setPreviewing] = React.useState<LessonContent | null>(null);
  // Locally-tracked signed status — flips optimistically when the employee
  // signs an SOP so the gate unlocks without a page refresh.
  const [sopsState, setSopsState] = React.useState<ModuleSopStatus[]>(moduleSops);
  React.useEffect(() => { setSopsState(moduleSops); }, [moduleSops]);
  const pendingSops = sopsState.filter((s) => !s.signed);

  // Content is OPEN pre-study material — any assigned employee can read it
  // before the seminar. The required-resources gate is a reminder here; it only
  // hard-blocks the QUIZ (enforced by the quiz page + quiz status card).
  const alreadyPassed = myAttempts.some((a) => a.status === "passed");
  const sopsCleared = pendingSops.length === 0 || alreadyPassed;
  const canViewMaterials = true;

  function openContent(item: LessonContent) {
    setPreviewing(item);
  }

  async function signSop(sop: ModuleSopStatus) {
    // Optimistic flip — page unlocks immediately while the row is written.
    setSopsState((prev) => prev.map((s) => (s.id === sop.id ? { ...s, signed: true, signedAt: new Date().toISOString() } : s)));
    const res = await acknowledgeResource(sop.id);
    if (!res.ok) {
      // Roll back if the server rejected
      setSopsState((prev) => prev.map((s) => (s.id === sop.id ? { ...s, signed: false, signedAt: null } : s)));
      toast.error(res.error ?? t("module.signError"));
      return;
    }
    toast.success(t("module.signedToast", { title: sop.title }));
  }

  return (
    <>
      {!sessionEndedAt && (
        <DeliveryLiveSync
          slug={mod.slug}
          signature={`${checkinOpen}|${!!sessionStartedAt}|${!!sessionEndedAt}|${isCheckedIn}`}
        />
      )}
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={backHref}><ArrowLeft className="size-4 mr-1" /> All Modules</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledDate ? fmtDate(mod.scheduledDate) : mod.scheduledMonth}`}
        title={mod.title}
        description={mod.description}
      />

      {/* ─── Required-resources reminder ───────────────────────────
          A non-blocking reminder: the employee can still study the content
          below before the seminar, but the QUIZ stays locked until every
          required resource is signed (enforced on the quiz page). */}
      {!sopsCleared && pendingSops.length > 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/15 overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Lock className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-lg">{t("module.signResources")}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("module.signResourcesDesc")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {sopsState.map((sop) => (
                <div
                  key={sop.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${
                    sop.signed
                      ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-border bg-card"
                  }`}
                >
                  <div className={`size-9 rounded flex items-center justify-center shrink-0 ${
                    sop.signed
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {sop.signed ? <CheckCircle2 className="size-4" /> : <FileText className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{sop.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {sop.category}{sop.description ? ` · ${sop.description}` : ""}
                    </div>
                  </div>
                  {sop.externalUrl && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={sop.externalUrl} target="_blank" rel="noreferrer">
                        {t("module.openExternal")}
                      </a>
                    </Button>
                  )}
                  {sop.signed ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                      ✓ {t("module.signed")}
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => signSop(sop)}>
                      {t("module.readUnderstood")}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="size-3" />
              {t("module.stillToSign", { n: pendingSops.length, total: sopsState.length })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content + quiz card always render — content is open pre-study. */}
      {(<>

      {/* Check-in (only meaningful on the seminar day, once the trainer opens
          it). Lets the employee enter the room code right from the module. */}
      {!sessionEndedAt && (checkinOpen || isCheckedIn) && (
        <div className="mb-4">
          <CheckInCard
            manager={{ id: managerId, name: managerName }}
            mod={mod}
            initialCheckedIn={isCheckedIn}
            sessionStartedAt={sessionStartedAt}
            sessionEndedAt={sessionEndedAt}
            checkinOpen={checkinOpen}
          />
        </div>
      )}

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
        <StatCard icon={Calendar} label={t("module.trainingDay")} value={mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—"} />
        <StatCard icon={Clock} label={t("module.totalLength")} value={`${totalMinutes} ${t("common.minutes")}`} sub={t("module.lessons", { n: mod.lessons.length })} />
        <StatCard icon={Target} label={t("module.passAt")} value={`${Math.round(mod.passThreshold * 100)}%`} />
        <StatCard icon={Layers} label={t("module.quiz")} value={t("module.questions", { n: mod.questionCount })} sub={mod.timeLimitMinutes ? t("module.timeLimit", { n: mod.timeLimitMinutes }) : t("module.untimed")} />
      </div>

      <Card className={cn("mb-6", canViewMaterials ? "border-primary/20 bg-primary/[0.03]" : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/15")}>
        <CardContent className="p-4 flex items-start gap-3">
          {canViewMaterials
            ? <Info className="size-5 text-primary shrink-0 mt-0.5" />
            : <Lock className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
          <div className="text-sm">
            <span className="font-semibold text-foreground">{t("module.howThisWorks")}</span>
            <span className="text-muted-foreground"> This module is delivered as a <span className="font-medium text-foreground">{totalMinutes}-minute live in-person session</span> by {teacher?.name ?? "your trainer"}, broken into <span className="font-medium text-foreground">{mod.lessons.length} lessons</span>. {canViewMaterials
              ? "Show up to the room, listen, then take the quiz right after."
              : "The materials below stay locked until you check in at the live seminar — that's where you learn the content, then take the quiz right after."}</span>
          </div>
        </CardContent>
      </Card>

      <div id="seminar-outline" className="flex items-center justify-between mb-3 scroll-mt-24">
        <h3 className="text-lg font-semibold tracking-tight">{t("module.seminarOutline")}</h3>
        <Badge variant="secondary" className="text-[10px]">{t("module.availableNow")}</Badge>
      </div>
      <div className="space-y-3">
        {mod.lessons.map((lesson) => (
          <Card key={lesson.id} className="overflow-hidden">
            <div className="grid grid-cols-[auto_1fr] gap-0">
              <div className="bg-primary/5 border-r flex flex-col items-center justify-center p-5 min-w-[80px]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("module.lessonCol")}</div>
                <div className="text-3xl font-bold tabular-nums text-primary mt-1">{lesson.order}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> {lesson.durationMinutes} {t("common.minutes")}
                </div>
              </div>

              <div className="p-5">
                <div className="font-semibold text-base">{lesson.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>

                <div className="mt-4 space-y-1.5">
                  {/* Items the lead marked "hide from employee preview" are
                      kept out of pre-study (they still play in the live seminar). */}
                  {lesson.contents.filter((item) => !item.previewHidden).map((item) => {
                    const meta = TYPE_META[item.type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => openContent(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md border bg-card transition-all text-left group",
                          canViewMaterials ? "hover:bg-accent/40 hover:border-primary/40" : "cursor-not-allowed opacity-70",
                        )}
                      >
                        <div className={cn("size-7 rounded flex items-center justify-center shrink-0", meta.tint)}>
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-medium truncate", canViewMaterials && "group-hover:text-primary transition-colors")}>{item.title}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{t(("type." + item.type) as Parameters<typeof t>[0])}</span>
                            {item.durationMinutes && (
                              <>
                                <span className="text-muted-foreground/50">·</span>
                                <span>{item.durationMinutes} {t("common.minutes")}</span>
                              </>
                            )}
                            {canViewMaterials && item.fileName && (
                              <>
                                <span className="text-muted-foreground/50">·</span>
                                <span className="truncate">{item.fileName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {canViewMaterials ? (
                          <Badge variant="outline" className="text-[10px] shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors">
                            {item.type === "link" ? t("module.openNewBadge") : t("module.previewBadge")}
                          </Badge>
                        ) : (
                          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {canViewMaterials && mod.flashcards && mod.flashcards.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold tracking-tight">{t("module.optionalSelfStudy")}</h3>
            <Badge variant="secondary" className="text-[10px]">
              <Sparkles className="size-3 mr-1 text-[var(--ai)]" />
              {t("module.flashcards", { n: mod.flashcards.length })}
            </Badge>
          </div>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                {t("module.flashcardsDesc")}
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
                  {t("module.seeAllFlashcards", { n: mod.flashcards.length })}
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <div className="mt-10 pt-6 border-t flex items-center gap-3 text-sm">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {t("module.taughtBy")} <span className="font-medium text-foreground">{teacher?.name ?? "—"}</span>
          {teacher?.bio && ` · ${teacher.bio}`}
        </span>
      </div>

      </>)}

      <ContentViewer content={canViewMaterials ? previewing : null} onClose={() => setPreviewing(null)} moduleSlug={mod.slug} />
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
