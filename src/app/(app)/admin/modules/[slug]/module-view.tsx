"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pagination, pageSlice } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, ArrowUpRight, Calendar, Clock, Layers, Target, FileText, PlayCircle,
  Link2, ListChecks, BarChart3, Trophy, Users, AlertTriangle, PresentationIcon, Sparkles, Loader2,
  Pencil, CheckCircle2, GraduationCap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { ModuleRoster, type AddableManager } from "@/components/shared/module-roster";
import { DeliveryHistory } from "@/components/shared/delivery-history";
import { ScheduleRedelivery } from "@/components/admin/schedule-redelivery";
import { RescheduleSeminar } from "@/components/admin/reschedule-seminar";
import { ModuleSetupPanel } from "@/components/admin/module-setup-panel";
import { EditModuleSheet } from "@/components/admin/edit-module-sheet";
import { ContentViewer } from "@/components/manager/content-viewer";
import { fmtDate, fmtTimeWithZone, initials } from "@/lib/format";
import { toast } from "sonner";
import { linkResourceToModule, unlinkResourceFromModule } from "@/lib/server/module-resources-actions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LessonContent } from "@/types";
import type { Resource } from "@/lib/db/resources";
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
  allTeachers?: { id: string; name: string }[];
  attempts: Attempt[];
  questions: Question[];
  roster: RosterRow[];
  counts: RosterCounts;
  deliveries: DeliveryRecord[];
  managersById: Record<string, Pick<Manager, "id" | "name" | "avatarColor" | "cohort">>;
  currentDeliveryStart: string | null;
  addableManagers?: AddableManager[];
  linkedSops?: Resource[];
  allSops?: Resource[];
}

export function AdminModuleView({
  mod,
  moduleTeachers,
  allTeachers = [],
  attempts,
  questions,
  roster,
  counts: rosterCounts,
  deliveries,
  managersById,
  currentDeliveryStart,
  addableManagers = [],
  linkedSops = [],
  allSops = [],
}: AdminModuleViewProps) {
  const slug = mod.slug;
  // Inline content preview — click any content item to play / view it in the
  // same ContentViewer the employees see, without leaving the module page.
  const [previewing, setPreviewing] = React.useState<LessonContent | null>(null);

  // SOPs linked to this module — admins can add/remove them. Optimistic local
  // state so the list reacts instantly without a full page refresh.
  const [sops, setSops] = React.useState<Resource[]>(linkedSops);
  React.useEffect(() => { setSops(linkedSops); }, [linkedSops]);
  const linkedIds = new Set(sops.map((s) => s.id));
  const unlinkedSops = allSops.filter((s) => !linkedIds.has(s.id));

  async function handleLinkSop(sop: Resource) {
    setSops((prev) => [...prev, sop]);
    const res = await linkResourceToModule(slug, sop.id);
    if (!res.ok) {
      setSops((prev) => prev.filter((s) => s.id !== sop.id));
      toast.error(res.error ?? "Could not link the resource");
      return;
    }
    toast.success(`Linked: ${sop.title}`);
  }

  async function handleUnlinkSop(sop: Resource) {
    setSops((prev) => prev.filter((s) => s.id !== sop.id));
    const res = await unlinkResourceFromModule(slug, sop.id);
    if (!res.ok) {
      setSops((prev) => [...prev, sop]);
      toast.error(res.error ?? "Could not unlink the resource");
      return;
    }
    toast.success(`Unlinked: ${sop.title}`);
  }

  // Tab state — purely LOCAL for instant, smooth switching. The active tab is
  // mirrored into the URL silently via history.replaceState (no Next navigation,
  // so no re-render / loader / flicker), so a refresh or deep-link keeps the tab.
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTabState] = React.useState(() => sp?.get("tab") ?? "overview");

  function setTab(v: string) {
    if (v === tab) return;
    setTabState(v);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      p.set("tab", v);
      window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
    }
  }

  // Content fades in on switch — no loader, it's already client-side.
  const TabBody = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      key={tab}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );

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

  // An "attempt" = a quiz the employee actually sat and submitted. The other
  // statuses are NOT real attempts and must never be counted:
  //   • "scheduled"   — an assigned retake that hasn't been taken yet.
  //   • "in-progress" — opened but never submitted (e.g. abandoned, or a
  //     module with no questions). The old flow could leave a stray one of
  //     these, which is what made one usage look like two.
  const submittedAttempts = attempts.filter((a) => a.status === "passed" || a.status === "failed");
  const passed = submittedAttempts.filter((a) => a.status === "passed").length;
  const failed = submittedAttempts.filter((a) => a.status === "failed").length;
  const passRate = submittedAttempts.length ? Math.round((passed / submittedAttempts.length) * 100) : 0;
  const avgScore = submittedAttempts.length
    ? Math.round(submittedAttempts.reduce((s, a) => s + Number(a.scorePct), 0) / submittedAttempts.length)
    : 0;

  const approvedQs = questions.filter((q) => q.status === "approved").length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/modules"><ArrowLeft className="size-4 mr-1" /> All Modules</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledDate ? fmtDate(mod.scheduledDate) : mod.scheduledMonth}${totalDeliveries > 1 ? ` · Delivery ${currentDeliveryIdx} of ${totalDeliveries}` : ""}`}
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
            <EditModuleSheet mod={mod} allTeachers={allTeachers} />
            <Button asChild variant="outline">
              <Link href={`/manager/modules/${slug}`}>
                <GraduationCap className="mr-2 size-4" /> Take it yourself
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

      <ModuleSetupPanel
        slug={slug}
        moduleTitle={mod.title}
        status={mod.status}
        lessonCount={mod.lessons.length}
        contentItemCount={contentCounts.totalItems}
        questionsApproved={approvedQs}
        questionsTotal={questions.length}
        questionCount={mod.questionCount}
        currentDeliveryStart={currentDeliveryStart}
        attendeeCount={rosterCounts.expected}
        scheduledDate={mod.scheduledDate}
        scheduledTime={mod.scheduledTime}
        timezone={mod.timezone}
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="deliveries">Past deliveries</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW — aggregate-safe, no private per-employee info ───── */}
        <TabsContent value="overview">
          <TabBody>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Attempts" value={submittedAttempts.length} icon={Users} href={`/admin/modules/${slug}?tab=reports`} />
        <KpiCard label="Pass rate" value={submittedAttempts.length ? `${passRate}%` : "—"} icon={Trophy} accent="success" href={`/admin/modules/${slug}?tab=reports&status=passed`} />
        <KpiCard label="Avg score" value={submittedAttempts.length ? `${avgScore}%` : "—"} icon={Target} href={`/admin/modules/${slug}?tab=reports`} />
        <KpiCard label="Failed attempts" value={failed} icon={AlertTriangle} accent="warning" href={`/admin/modules/${slug}?tab=reports&status=failed`} />
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

          <LessonsList lessons={mod.lessons} onPreview={setPreviewing} />

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
                    <div className="text-xs text-muted-foreground mt-0.5">{submittedAttempts.length} attempts logged</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {/* Required SOPs — employees must sign every linked SOP before this
              module unlocks for them. */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <FileText className="size-3.5 text-amber-600 dark:text-amber-400" />
                Required resources
              </CardTitle>
              {unlinkedSops.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="outline">+ Link resource</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    {unlinkedSops.map((s) => (
                      <DropdownMenuItem key={s.id} onClick={() => handleLinkSop(s)}>
                        <span className="truncate">{s.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {sops.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No resources linked. Managers can start this module without signing anything.
                </p>
              ) : (
                <>
                  {sops.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border px-2.5 py-2 bg-card">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{s.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.category}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkSop(s)}
                        className="text-[10px] text-muted-foreground hover:text-rose-600"
                        title="Remove from module"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Managers must sign all {sops.length} before this module unlocks.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Module {moduleTeachers.length > 1 ? "owners" : "owner"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleTeachers.map((t) => (
                <Link key={t.id} href={`/admin/teachers?q=${encodeURIComponent(t.name)}`} className="flex items-center gap-3 group">
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
              <Field icon={Clock} label="Start time" value={fmtTimeWithZone(mod.scheduledTime, mod.timezone) ?? "—"} />
              <Field icon={Clock} label="Seminar length" value={`${totalMinutes} min`} />
              <Field icon={Target} label="Pass threshold" value={`${Math.round(mod.passThreshold * 100)}%`} />
              <Field icon={Layers} label="Quiz" value={`${mod.questionCount} questions`} />
              <Field icon={Clock} label="Quiz time limit" value={mod.timeLimitMinutes ? `${mod.timeLimitMinutes} min` : "No limit"} />
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

          </TabBody>
        </TabsContent>

        {/* ─── CONTENT — lessons + items, with a jump to the full editor ── */}
        <TabsContent value="content">
          <TabBody>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Layers className="size-5 text-muted-foreground" /> Lessons &amp; content
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {contentCounts.totalItems} items across {mod.lessons.length} lessons. Click any item to preview it.
                </p>
              </div>
              <Button asChild>
                <Link href={`/teacher/modules/${slug}/content`}>
                  <Pencil className="size-4 mr-1.5" /> Edit content
                </Link>
              </Button>
            </div>
            <LessonsList lessons={mod.lessons} onPreview={setPreviewing} />
          </TabBody>
        </TabsContent>

        {/* ─── QUESTIONS — bank summary + jump to the review screen ── */}
        <TabsContent value="questions">
          <TabBody>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <ListChecks className="size-5 text-muted-foreground" /> Question bank
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {approvedQs} of {questions.length} approved · {questions.filter((q) => q.pool === "retake").length} in the retake pool
                </p>
              </div>
              <Button asChild>
                <Link href={`/teacher/modules/${slug}/questions`}>
                  <Pencil className="size-4 mr-1.5" /> Review &amp; edit questions
                </Link>
              </Button>
            </div>
            <QuestionBankList questions={questions} />
          </TabBody>
        </TabsContent>

        {/* ─── ROSTER — private per-employee info, separated from Overview ── */}
        <TabsContent value="roster">
          <TabBody>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Users className="size-5 text-muted-foreground" />
                Current roster
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Who&rsquo;s expected for the current delivery — private to admins and leads.
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
          </TabBody>
        </TabsContent>

        {/* ─── PAST DELIVERIES ──────────────────────────────────────── */}
        <TabsContent value="deliveries">
          <TabBody>
          <h3 className="text-lg font-semibold tracking-tight mb-3">Past deliveries</h3>
          <DeliveryHistory
            moduleSlug={slug}
            deliveries={deliveries}
            managersById={managersById}
            attempts={attempts}
          />
          </TabBody>
        </TabsContent>

        {/* ─── REPORTS — detailed per-attempt results ──────────────── */}
        <TabsContent value="reports">
          <TabBody>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Reports</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every attempt logged on this module. Drill into any row for the
                question-by-question review.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/results?module=${slug}`}>
                Open full Test Results <ArrowUpRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
          {submittedAttempts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No attempts yet for this module.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Manager</th>
                      <th className="text-left px-5 py-2.5 font-medium">Date</th>
                      <th className="text-left px-5 py-2.5 font-medium">Pool</th>
                      <th className="text-left px-5 py-2.5 font-medium">Score</th>
                      <th className="text-left px-5 py-2.5 font-medium">Status</th>
                      <th className="text-left px-5 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* Only real (submitted) attempts — never in-progress / scheduled placeholders. */}
                    {[...submittedAttempts]
                      .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
                      .map((a) => {
                        const mgr = managersById[a.managerId];
                        return (
                          <tr key={a.id} className="hover:bg-accent/40 cursor-pointer" onClick={() => router.push(`/admin/results/${a.id}`)}>
                            <td className="px-5 py-3 font-medium">{mgr?.name ?? "—"}</td>
                            <td className="px-5 py-3 text-muted-foreground">{fmtDate(a.startedAt, "MMM d, yyyy")}</td>
                            <td className="px-5 py-3">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {a.pool === "retake" ? "Retake" : "First attempt"}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 font-mono tabular-nums">{Math.round(a.scorePct)}%</td>
                            <td className="px-5 py-3"><StatusBadge variant={a.status as "passed" | "failed"} /></td>
                            <td className="px-5 py-3 text-right text-muted-foreground"><ArrowUpRight className="size-3.5 inline" /></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          </TabBody>
        </TabsContent>
      </Tabs>

      <ContentViewer content={previewing} onClose={() => setPreviewing(null)} moduleSlug={mod.slug} />
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

/** Read-only lessons + content list, shared by the Overview and Content tabs. */
function LessonsList({ lessons, onPreview }: { lessons: ModuleDef["lessons"]; onPreview: (c: LessonContent) => void }) {
  if (lessons.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
        No lessons yet. Use “Edit content” to add the first lesson.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {lessons.map((lesson) => (
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
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onPreview(c)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/40 hover:border-primary/40 transition-colors group"
                    >
                      <div className={cn("size-7 rounded flex items-center justify-center shrink-0", meta.tint)}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {c.title}
                          {c.presentationHidden && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-muted-foreground">Not on presentation day</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{meta.label}</span>
                          {c.durationMinutes && (<><span className="text-muted-foreground/50">·</span><span>{c.durationMinutes} min</span></>)}
                          {c.fileName && (<><span className="text-muted-foreground/50">·</span><span className="truncate">{c.fileName}</span></>)}
                          {c.fileSize && (<><span className="text-muted-foreground/50">·</span><span>{c.fileSize}</span></>)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-colors">
                        {c.type === "link" ? "Open ↗" : "Preview"}
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
  );
}

/** Read-only question-bank summary for the Questions tab. */
function QuestionBankList({ questions }: { questions: Question[] }) {
  const [pool, setPool] = React.useState<"all" | "first-attempt" | "retake">("all");
  const [page, setPage] = React.useState(0);
  const PER_PAGE = 10;

  const firstCount = questions.filter((q) => q.pool === "first-attempt").length;
  const retakeCount = questions.filter((q) => q.pool === "retake").length;
  const filtered = pool === "all" ? questions : questions.filter((q) => q.pool === pool);

  // Reset to the first page whenever the pool filter changes.
  React.useEffect(() => { setPage(0); }, [pool]);

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
        No questions yet. Use “Review &amp; edit questions” to generate and approve a bank.
      </div>
    );
  }

  const chips: { key: "all" | "first-attempt" | "retake"; label: string; count: number }[] = [
    { key: "all", label: "All", count: questions.length },
    { key: "first-attempt", label: "First attempt", count: firstCount },
    { key: "retake", label: "Retake", count: retakeCount },
  ];

  return (
    <div className="space-y-3">
      {/* Pool filter — clearly separate first-attempt vs retake, paginated so a
          big bank (e.g. 68 questions) never makes the page huge. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setPool(c.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              pool === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent text-muted-foreground",
            )}
          >
            {c.label}
            <span className={cn("rounded px-1 text-[10px] tabular-nums", pool === c.key ? "bg-white/20" : "bg-muted")}>{c.count}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} question{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-1.5">
        {pageSlice(filtered, page, PER_PAGE).map((q) => {
          const live = q.status === "approved" || q.status === "edited";
          return (
            <div key={q.id} className="flex items-start gap-3 px-3 py-2 rounded-md border bg-card">
              {live ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Clock className="size-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm line-clamp-2">{q.text}</div>
              </div>
              <Badge
                variant="outline"
                className={cn("text-[10px] shrink-0", q.pool === "retake" ? "border-violet-500/40 text-violet-600 dark:text-violet-400" : "border-sky-500/40 text-sky-600 dark:text-sky-400")}
              >
                {q.pool === "retake" ? "Retake" : "First"}
              </Badge>
              <StatusBadge variant={q.status} />
            </div>
          );
        })}
      </div>

      <Pagination page={page} total={filtered.length} pageSize={PER_PAGE} onPageChange={setPage} />
    </div>
  );
}
