"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, BookOpen, Calendar, Target, Clock, Layers, Lock, Check, Users, Loader2,
  ArrowRight, ArrowLeft, ListChecks, Rocket, Mail,
} from "lucide-react";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LessonsBuilder, emptyLesson } from "@/components/admin/lessons-builder";
import { QuestionReviewPanel } from "@/components/admin/question-review-panel";
import { createModule, publishModule, getDueEmployees, scheduleSeminar, notifySeminar } from "@/lib/server/module-actions";
import { linkResourceToModule } from "@/lib/server/module-resources-actions";
import type { Lesson, Teacher } from "@/types";
import type { Resource } from "@/lib/db/resources";

interface AddModuleSheetProps {
  trigger?: React.ReactNode;
  teachers: Teacher[];
  defaultNumber?: number;
  lockedOwnerId?: string;
  /** All existing SOPs that the admin can link to this new module. */
  allSops?: Resource[];
}

type DueEmployee = { id: string; name: string; email: string; cohort: string | null };

export function AddModuleSheet({ trigger, teachers, defaultNumber = 6, lockedOwnerId, allSops = [] }: AddModuleSheetProps) {
  const router = useRouter();
  const lockedOwner = lockedOwnerId ? teachers.find((t) => t.id === lockedOwnerId) : null;
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [createdSlug, setCreatedSlug] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Step 1 — details + content
  const [number, setNumber] = React.useState<number>(defaultNumber);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [ownerTeacherIds, setOwnerTeacherIds] = React.useState<string[]>(lockedOwnerId ? [lockedOwnerId] : []);
  const [passThreshold, setPassThreshold] = React.useState(85);
  const [questionCount, setQuestionCount] = React.useState(25);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(30);
  const [hasTimeLimit, setHasTimeLimit] = React.useState(true);
  const draftSlug = React.useMemo(
    () => title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `m-${number}`,
    [title, number],
  );
  const [lessons, setLessons] = React.useState<Lesson[]>(() => [emptyLesson(draftSlug, 1)]);
  // SOPs the admin wants to link as "required reading" — employees must sign
  // each one before the module unlocks for them.
  const [selectedSopIds, setSelectedSopIds] = React.useState<Set<string>>(new Set());
  function toggleSop(id: string) {
    setSelectedSopIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const totalLessonMinutes = lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0);

  // Step 2 — generation (the interactive panel reports how many were added)
  const [genAdded, setGenAdded] = React.useState(0);

  // Step 3 — employees
  const [employees, setEmployees] = React.useState<DueEmployee[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [empLoading, setEmpLoading] = React.useState(false);
  const [empSearch, setEmpSearch] = React.useState("");

  // Step 4 — publish + notify progress
  const [notify, setNotify] = React.useState<{ sent: number; total: number } | null>(null);

  function toggleTeacher(id: string) {
    setOwnerTeacherIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetAll() {
    setStep(1);
    setCreatedSlug(null);
    setNumber((n) => n + 1);
    setTitle(""); setDescription(""); setScheduledDate(""); setScheduledTime("");
    setOwnerTeacherIds(lockedOwnerId ? [lockedOwnerId] : []);
    setLessons([emptyLesson(`m-${number + 1}`, 1)]);
    setSelectedSopIds(new Set());
    setGenAdded(0);
    setEmployees([]); setSelected(new Set()); setNotify(null); setEmpSearch("");
  }

  const canCreate = !!title.trim() && !!description.trim() && !!scheduledDate && ownerTeacherIds.length > 0 && lessons.length > 0;

  // ─── Step 1 → create ──────────────────────────────────────────────────
  async function handleCreate() {
    if (!canCreate) return;
    setSubmitting(true);
    const monthLabel = scheduledDate
      ? new Date(scheduledDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : null;
    const res = await createModule({
      slug: draftSlug, number, title: title.trim(), description: description.trim(),
      scheduledMonth: monthLabel, scheduledDate: scheduledDate || null, scheduledTime: scheduledTime || null, status: "draft",
      passThreshold: passThreshold / 100, questionCount,
      timeLimitMinutes: hasTimeLimit ? timeLimitMinutes : null,
      ownerTeacherIds, lessons,
    });
    if (!res.ok) { setSubmitting(false); toast.error(res.error ?? "Could not create module"); return; }
    // Link any SOPs the admin picked — fire them in parallel; the module is
    // already created, so a failure here only affects the SOP gating.
    if (selectedSopIds.size > 0) {
      await Promise.all(
        Array.from(selectedSopIds).map((id) => linkResourceToModule(draftSlug, id)),
      );
    }
    setSubmitting(false);
    setCreatedSlug(draftSlug);
    setStep(2);
    router.refresh();
  }

  // ─── Step 3 — load due employees ──────────────────────────────────────
  React.useEffect(() => {
    if (step !== 3 || !createdSlug) return;
    setEmpLoading(true);
    getDueEmployees(createdSlug).then((res) => {
      // Start with NOBODY selected — the admin must explicitly choose who
      // attends. Skipping this step (selecting no one) schedules no seminar
      // and emails nobody.
      if (res.ok) { setEmployees(res.employees); setSelected(new Set()); }
      else toast.error(res.error ?? "Could not load employees");
      setEmpLoading(false);
    });
  }, [step, createdSlug]);

  function toggleEmp(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const filteredEmployees = React.useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
  }, [employees, empSearch]);

  // Leave the module as a draft (already created in step 1) and close. Drafts
  // stay visible to admins/leads but hidden from employees until published.
  function saveDraftAndClose() {
    setOpen(false);
    resetAll();
    toast.success(`${title || "Module"} saved as a draft`, {
      description: "Not visible to employees until you publish it from the module page.",
    });
    router.refresh();
  }

  // ─── Step 4 — publish + schedule + notify ─────────────────────────────
  async function handlePublish() {
    if (!createdSlug) return;
    setSubmitting(true);
    const pub = await publishModule(createdSlug);
    if (!pub.ok) { setSubmitting(false); toast.error(pub.error ?? "Could not publish"); return; }

    const ids = [...selected];
    if (ids.length > 0 && scheduledDate) {
      const sch = await scheduleSeminar(createdSlug, scheduledDate, ids, scheduledTime || null);
      if (sch.ok) {
        setNotify({ sent: 0, total: ids.length });
        const CHUNK = 5;
        let sent = 0;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const r = await notifySeminar(createdSlug, "scheduled", ids.slice(i, i + CHUNK));
          sent += r.sent ?? 0;
          setNotify({ sent, total: ids.length });
        }
      }
    }
    setSubmitting(false);
    setNotify(null);
    setOpen(false);
    toast.success(`${title} published`, { description: ids.length ? `Seminar scheduled · ${ids.length} employee(s) notified.` : undefined });
    resetAll();
    router.refresh();
  }

  const stepLabels = ["Details & content", "Generate questions", "Choose employees", "Publish & send"];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        {trigger ?? (<Button><Plus className="mr-2 size-4" /> Add module</Button>)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="flex flex-col max-h-[88vh]">
          {/* ─── Header + stepper ─────────────────────────────────── */}
          <div className="shrink-0 border-b bg-muted/30 px-6 pt-6 pb-5">
            <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider mb-2">
              Step {step} of 4
            </Badge>
            <DialogTitle className="text-2xl tracking-tight">
              {step === 1 ? (lockedOwner ? "Create a module you'll own" : "Add a new training module") : title}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {step === 1 ? "Fill in the details and upload content. Next, AI drafts the quiz, you pick who takes it, and publish."
                : step === 2 ? "Review each AI-drafted question — Add the good ones, Skip the rest."
                : step === 3 ? "These employees are due for this module. Pick who attends — leave empty to schedule the seminar later."
                : "Publish the module and send it to the selected employees."}
            </DialogDescription>
            {/* numbered stepper */}
            <div className="flex items-center gap-2 mt-4">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const isDone = n < step;
                const isActive = n === step;
                return (
                  <React.Fragment key={n}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`size-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors ${
                        isDone ? "bg-primary text-primary-foreground"
                          : isActive ? "bg-primary/15 text-primary ring-2 ring-primary/30"
                          : "bg-muted text-muted-foreground"}`}>
                        {isDone ? <Check className="size-3.5" strokeWidth={3} /> : n}
                      </div>
                      <span className={`text-xs truncate hidden sm:inline ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                    {n < 4 && <div className={`h-px flex-1 min-w-3 ${isDone ? "bg-primary" : "bg-border"}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ─── Scrollable body ──────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ─── STEP 1 ─────────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-number" className="text-xs"><BookOpen className="size-3 inline mr-1" /> Number</Label>
                <Input id="m-number" type="number" min={1} max={20} value={number} onChange={(e) => setNumber(Number(e.target.value))} className="h-10 text-center font-mono text-lg font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-title" className="text-xs">Module title</Label>
                <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Customer Service Excellence" className="h-10" autoFocus />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-desc" className="text-xs">Description</Label>
              <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One sentence summarising what this module covers." rows={3} className="resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="m-date" className="text-xs"><Calendar className="size-3 inline mr-1" /> Training day</Label>
                <Input id="m-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-time" className="text-xs"><Clock className="size-3 inline mr-1" /> Start time</Label>
                <Input id="m-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-10" />
              </div>
            </div>

            {lockedOwner ? (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.04] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="size-4 text-primary" />
                  <span className="text-sm font-semibold">Assigned to Department Lead</span>
                  <Badge variant="outline" className="ml-auto text-[10px] gap-1"><Lock className="size-2.5" /> You — locked</Badge>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                  <Avatar className="size-10 border shrink-0"><AvatarImage src={lockedOwner.avatarUrl ?? undefined} alt={lockedOwner.name} className="object-cover" /><AvatarFallback style={{ background: lockedOwner.avatarColor, color: "white" }} className="text-sm font-semibold">{initials(lockedOwner.name)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{lockedOwner.name}</div><div className="text-xs text-muted-foreground truncate">{lockedOwner.email}</div></div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.04] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="size-4 text-primary" />
                  <Label className="text-sm font-semibold">Assign to Department Leads</Label>
                  {ownerTeacherIds.length === 0
                    ? <Badge variant="outline" className="ml-auto text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">Pick at least one</Badge>
                    : <Badge variant="outline" className="ml-auto text-[10px] text-primary border-primary/40 gap-1"><Check className="size-2.5" /> {ownerTeacherIds.length} selected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mb-3">Pick one or more Department Leads to co-own this module.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {teachers.map((t) => {
                    const sel = ownerTeacherIds.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => toggleTeacher(t.id)} aria-pressed={sel}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${sel ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:bg-accent/40 hover:border-primary/40"}`}>
                        <Avatar className="size-9 border shrink-0"><AvatarImage src={t.avatarUrl ?? undefined} alt={t.name} className="object-cover" /><AvatarFallback style={{ background: t.avatarColor, color: "white" }} className="text-xs font-semibold">{initials(t.name)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{t.name}</div></div>
                        <div className={`size-4 rounded shrink-0 flex items-center justify-center ${sel ? "bg-primary border-2 border-primary" : "border-2 border-muted-foreground/30"}`}>{sel && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Target className="size-3.5" /> Quiz settings</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-threshold" className="text-xs">Pass threshold</Label>
                  <div className="relative"><Input id="m-threshold" type="number" min={50} max={100} value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} className="h-9 pr-7" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span></div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-count" className="text-xs">Questions on the day</Label>
                  <Input id="m-count" type="number" min={5} max={100} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="h-9" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="m-time" className="text-xs flex items-center gap-1"><Clock className="size-3" /> Time limit</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{hasTimeLimit ? `${timeLimitMinutes} minutes` : "No time limit"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasTimeLimit && <Input type="number" min={5} max={120} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(Number(e.target.value))} className="h-9 w-20" />}
                  <Switch checked={hasTimeLimit} onCheckedChange={setHasTimeLimit} />
                </div>
              </div>
            </div>

            <div className="space-y-2 -mx-2 px-2 py-3 rounded-lg bg-muted/30">
              <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 px-1"><Layers className="size-3.5" /> Seminar plan — Lessons & content</Label>
              <p className="text-[11px] text-muted-foreground px-1">Upload videos, documents (Word/PDF), slides, or links. AI reads these to write the quiz.</p>
              <LessonsBuilder lessons={lessons} onChange={setLessons} moduleSlug={draftSlug} />
            </div>

            {/* Optional: link required SOPs to this module. Employees must
                sign each one before the module unlocks for them. */}
            {allSops.length > 0 && (
              <div className="space-y-2 -mx-2 px-2 py-3 rounded-lg bg-amber-50/40 dark:bg-amber-950/15 border border-amber-500/20">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 px-1 text-amber-700 dark:text-amber-300">
                  Required resources <span className="text-muted-foreground/70 font-normal lowercase">(optional)</span>
                </Label>
                <p className="text-[11px] text-muted-foreground px-1">
                  Employees will have to sign every resource picked here before they can take this module&rsquo;s quiz.
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                  {allSops.map((s) => {
                    const sel = selectedSopIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${sel ? "border-amber-500/40 bg-card" : "border-border bg-card/50 hover:bg-card"}`}
                      >
                        <Checkbox checked={sel} onCheckedChange={() => toggleSop(s.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.title}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{s.category}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selectedSopIds.size > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 px-1">
                    {selectedSopIds.size} resource{selectedSopIds.size === 1 ? "" : "s"} will be linked to this module.
                  </p>
                )}
              </div>
            )}

            <div className="sticky bottom-0 -mx-6 px-6 py-3 flex justify-end gap-2 border-t bg-background/95 backdrop-blur">
              <Button type="submit" disabled={!canCreate || submitting}>
                {submitting ? <><Loader2 className="size-4 animate-spin mr-1.5" /> Saving…</> : <>Save &amp; next: AI questions <ArrowRight className="size-4 ml-1" /></>}
              </Button>
            </div>
          </form>
        )}

        {/* ─── STEP 2 — generate (one-by-one review) ──────────────── */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              AI reads your content and drafts questions one at a time. <strong>Add</strong> the good ones, <strong>Skip</strong> the rest — skipped questions are discarded, nothing is saved.
            </p>
            {createdSlug && <QuestionReviewPanel moduleSlug={createdSlug} onAddedChange={setGenAdded} />}
            <div className="sticky bottom-0 -mx-6 px-6 py-3 flex items-center justify-between gap-3 border-t bg-background/95 backdrop-blur">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {genAdded > 0 ? `${genAdded} added so far` : "None added yet"}
              </span>
              <div className="flex gap-2 shrink-0">
                {genAdded === 0 && <Button variant="ghost" onClick={() => setStep(3)}>Skip</Button>}
                <Button onClick={() => setStep(3)}>
                  Next: employees <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3 — employees ─────────────────────────────────── */}
        {step === 3 && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <span className="text-sm font-medium flex items-center gap-2"><Users className="size-4 text-muted-foreground" />{empLoading ? "Loading…" : `${selected.size} of ${employees.length} selected`}</span>
                {employees.length > 0 && (
                  <button type="button" className="text-xs text-primary hover:underline"
                    onClick={() => setSelected(selected.size === employees.length ? new Set() : new Set(employees.map((e) => e.id)))}>
                    {selected.size === employees.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {employees.length > 0 && (
                <div className="px-3 py-2 border-b">
                  <Input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Search by name or email…" className="h-8 text-sm" />
                </div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y">
                {empLoading ? (
                  <div className="p-6 text-center"><Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" /></div>
                ) : employees.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No employees are due for this module right now.</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No employees match “{empSearch}”.</div>
                ) : filteredEmployees.map((e) => (
                  <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleEmp(e.id)} />
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{e.name}</div><div className="text-xs text-muted-foreground truncate">{e.email}{e.cohort ? ` · ${e.cohort}` : ""}</div></div>
                  </label>
                ))}
              </div>
            </div>
            <div className="sticky bottom-0 -mx-6 px-6 py-3 flex justify-between gap-2 border-t bg-background/95 backdrop-blur">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="size-4 mr-1" /> Back</Button>
              <Button onClick={() => setStep(4)} variant={selected.size === 0 ? "outline" : "default"}>
                {selected.size === 0 ? "Skip — no attendees" : `Continue · ${selected.size} selected`} <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 4 — publish ───────────────────────────────────── */}
        {step === 4 && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg border bg-card p-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 font-semibold"><Rocket className="size-4 text-primary" /> Ready to publish</div>
              <div className="flex items-center gap-2 text-muted-foreground"><ListChecks className="size-4" /> {genAdded > 0 ? `${genAdded} questions added` : "Questions can be added later"}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /> Seminar on {scheduledDate || "—"}</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="size-4" /> {selected.size > 0 ? `${selected.size} employee(s) will be invited & emailed` : "No attendees — schedule & email later from the module page"}</div>
            </div>
            {notify && (
              <div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${notify.total ? (notify.sent / notify.total) * 100 : 0}%` }} /></div>
                <p className="text-[11px] text-muted-foreground mt-1">Emailing employees… {notify.sent} of {notify.total}</p>
              </div>
            )}
            <div className="sticky bottom-0 -mx-6 px-6 py-3 flex justify-between gap-2 border-t bg-background/95 backdrop-blur">
              <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}><ArrowLeft className="size-4 mr-1" /> Back</Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={saveDraftAndClose} disabled={submitting}>Save as draft</Button>
                <Button onClick={handlePublish} disabled={submitting}>
                  {submitting ? <><Loader2 className="size-4 animate-spin mr-1.5" /> {notify ? `Emailing ${notify.sent}/${notify.total}…` : "Publishing…"}</> : <><Rocket className="size-4 mr-1.5" /> {selected.size > 0 ? "Publish & send" : "Publish module"}</>}
                </Button>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
