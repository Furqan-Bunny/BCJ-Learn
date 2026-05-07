"use client";

import * as React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Sparkles, BookOpen, Calendar, Target, Clock, Layers, Lock, Check, Users } from "lucide-react";
import { teachers } from "@/data/users";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { LessonsBuilder, emptyLesson } from "@/components/admin/lessons-builder";
import type { Lesson } from "@/types";

interface AddModuleSheetProps {
  trigger?: React.ReactNode;
  /**
   * If set, the owner field is locked to this teacher id (can't be changed).
   * Used when a Teacher creates a module — they can only create modules they own.
   * Admin path (no lockedOwnerId) shows the full teacher dropdown.
   */
  lockedOwnerId?: string;
}

export function AddModuleSheet({ trigger, lockedOwnerId }: AddModuleSheetProps) {
  const lockedOwner = lockedOwnerId ? teachers.find((t) => t.id === lockedOwnerId) : null;
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [number, setNumber] = React.useState<number>(6);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [ownerTeacherIds, setOwnerTeacherIds] = React.useState<string[]>(lockedOwnerId ? [lockedOwnerId] : []);

  function toggleTeacher(id: string) {
    setOwnerTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  const [passThreshold, setPassThreshold] = React.useState(85);
  const [questionCount, setQuestionCount] = React.useState(25);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(30);
  const [hasTimeLimit, setHasTimeLimit] = React.useState(true);
  const [autoGenerate, setAutoGenerate] = React.useState(true);

  // Lessons (the seminar plan)
  const draftSlug = React.useMemo(
    () => title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `m-${number}`,
    [title, number],
  );
  const [lessons, setLessons] = React.useState<Lesson[]>(() => [emptyLesson(draftSlug, 1)]);
  const totalLessonMinutes = lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0);


  const canSubmit = !!title.trim() && !!description.trim() && !!scheduledDate && ownerTeacherIds.length > 0 && lessons.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setOpen(false);
      const ownerNames = lockedOwner
        ? [lockedOwner.name]
        : ownerTeacherIds.map((id) => teachers.find((t) => t.id === id)?.name).filter(Boolean) as string[];
      const ownerLabel = ownerNames.length === 0
        ? ""
        : ownerNames.length === 1
          ? `${ownerNames[0]} is the owner`
          : `${ownerNames.slice(0, -1).join(", ")} and ${ownerNames[ownerNames.length - 1]} co-own this module`;
      toast.success(`Module "${title}" created as draft`, {
        description: `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} · ${totalLessonMinutes} min total. ${
          ownerLabel ? `${ownerLabel} — they'll schedule sessions and the system handles invitations. ` : ""
        }${
          lockedOwner
            ? "Add content, approve questions, then publish when ready."
            : autoGenerate
              ? "AI is drafting questions in the background. You'll be notified when ready for review."
              : "Add questions manually whenever you're ready."
        }`,
      });
      // Reset form
      setNumber(number + 1);
      setTitle("");
      setDescription("");
      setScheduledDate("");
      setOwnerTeacherIds(lockedOwnerId ? [lockedOwnerId] : []);
      setLessons([emptyLesson(`m-${number + 1}`, 1)]);
    }, 800);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 size-4" /> Add module
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-2">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
            {lockedOwner ? "Create your module" : "New module"}
          </Badge>
          <SheetTitle className="text-2xl tracking-tight">
            {lockedOwner ? "Create a module you'll own" : "Add a new training module"}
          </SheetTitle>
          <SheetDescription>
            {lockedOwner
              ? "You'll be the owner of this module — you can edit content, approve AI questions, and present it. Saved as a draft until you publish."
              : "Modules become available to Employees in the order you set. AI can draft a starter question bank from your uploaded content."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-5">
          {/* Number + title */}
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-number" className="text-xs">
                <BookOpen className="size-3 inline mr-1" /> Number
              </Label>
              <Input
                id="m-number"
                type="number"
                min={1}
                max={20}
                value={number}
                onChange={(e) => setNumber(Number(e.target.value))}
                className="h-10 text-center font-mono text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-title" className="text-xs">Module title</Label>
              <Input
                id="m-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Customer Service Excellence"
                className="h-10"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="m-desc" className="text-xs">Description</Label>
            <Textarea
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence summarising what this module covers."
              rows={3}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on the manager dashboard and in module cards.
            </p>
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label htmlFor="m-date" className="text-xs">
              <Calendar className="size-3 inline mr-1" /> Training day
            </Label>
            <Input
              id="m-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="h-10 max-w-xs"
            />
          </div>

          {/* Assign to Teacher — prominent, full-width picker */}
          {lockedOwner ? (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="size-4 text-primary" />
                <span className="text-sm font-semibold">Assigned to Department Lead</span>
                <Badge variant="outline" className="ml-auto text-[10px] gap-1">
                  <Lock className="size-2.5" /> You — locked
                </Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <Avatar className="size-10 border shrink-0">
                  <AvatarFallback
                    style={{ background: lockedOwner.avatarColor, color: "white" }}
                    className="text-sm font-semibold"
                  >
                    {initials(lockedOwner.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{lockedOwner.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{lockedOwner.email}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="size-4 text-primary" />
                <Label className="text-sm font-semibold">Assign to Department Leads</Label>
                {ownerTeacherIds.length === 0 ? (
                  <Badge variant="outline" className="ml-auto text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">
                    Pick at least one
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto text-[10px] text-primary border-primary/40 gap-1">
                    <Check className="size-2.5" /> {ownerTeacherIds.length} selected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Pick one or more Department Leads to co-own this module. They&rsquo;ll edit content, approve AI questions, schedule sessions, and take turns presenting it live.
              </p>

              <div className="grid sm:grid-cols-2 gap-2">
                {teachers.map((t) => {
                  const selected = ownerTeacherIds.includes(t.id);
                  const moduleCount = t.ownedModuleSlugs.length;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeacher(t.id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                          : "border-border bg-card hover:bg-accent/40 hover:border-primary/40"
                      }`}
                    >
                      <Avatar className="size-9 border shrink-0">
                        <AvatarFallback
                          style={{ background: t.avatarColor, color: "white" }}
                          className="text-xs font-semibold"
                        >
                          {initials(t.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {t.name}
                          {selected && <Sparkles className="size-3 text-primary shrink-0" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {moduleCount === 0 ? "No modules yet" : `${moduleCount} module${moduleCount === 1 ? "" : "s"} owned`}
                        </div>
                      </div>
                      <div
                        className={`size-4 rounded shrink-0 flex items-center justify-center transition-all ${
                          selected ? "border-primary bg-primary border-2" : "border-2 border-muted-foreground/30"
                        }`}
                      >
                        {selected && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {ownerTeacherIds.length > 1 && (
                <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Sparkles className="size-3 mt-0.5 text-primary shrink-0" />
                  <span>
                    Co-owned modules: any owner can edit content, approve questions, and present sessions. The first selected is the primary contact.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quiz settings */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="size-3.5" /> Quiz settings
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-threshold" className="text-xs">Pass threshold</Label>
                <div className="relative">
                  <Input
                    id="m-threshold"
                    type="number"
                    min={50}
                    max={100}
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(Number(e.target.value))}
                    className="h-9 pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-count" className="text-xs">Questions on the day</Label>
                <Input
                  id="m-count"
                  type="number"
                  min={5}
                  max={100}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label htmlFor="m-time" className="text-xs flex items-center gap-1">
                  <Clock className="size-3" /> Time limit
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {hasTimeLimit ? `${timeLimitMinutes} minutes` : "No time limit"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasTimeLimit && (
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="h-9 w-20"
                  />
                )}
                <Switch checked={hasTimeLimit} onCheckedChange={setHasTimeLimit} />
              </div>
            </div>
          </div>

          {/* AI generation */}
          <div className="rounded-lg border-2 border-dashed border-[var(--ai)]/30 bg-[var(--ai)]/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[var(--ai)]" />
                  <Label htmlFor="m-ai" className="text-sm font-semibold cursor-pointer">
                    Auto-draft questions with AI
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Once you upload a manual or slides, AI will draft 50 first-attempt + 30 retake (easier) questions for the Department Lead to review and approve.
                </p>
              </div>
              <Switch id="m-ai" checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            </div>
          </div>

          {/* Lessons (the seminar plan) */}
          <div className="space-y-2 -mx-2 px-2 py-3 rounded-lg bg-muted/30">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="size-3.5" /> Seminar plan — Lessons
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Break the {totalLessonMinutes || "—"}-minute seminar into lessons. Add videos, documents, slide decks, or external links to each lesson. The Department Lead will present them in order.
                </p>
              </div>
            </div>
            <LessonsBuilder
              lessons={lessons}
              onChange={setLessons}
              moduleSlug={draftSlug}
            />
          </div>
        </form>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Creating…" : "Create module as draft"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
