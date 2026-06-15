"use client";

// Admin-only "Edit module" sheet: change metadata + owners, archive/unarchive,
// or delete (only when the module has no attempts; guarded by a title-confirm).
// Content/lessons are edited separately on the content page.

import * as React from "react";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Star, Rocket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  updateModuleMetadata,
  updateModuleOwners,
  publishModule,
  unpublishModule,
  deleteModule,
} from "@/lib/server/module-actions";
import { TIMEZONES, defaultTimezone } from "@/lib/timezones";
import type { ModuleDef } from "@/types";

interface Props {
  mod: ModuleDef;
  allTeachers: { id: string; name: string }[];
}

export function EditModuleSheet({ mod, allTeachers }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const [number, setNumber] = React.useState(String(mod.number));
  const [title, setTitle] = React.useState(mod.title);
  const [description, setDescription] = React.useState(mod.description);
  const [scheduledMonth, setScheduledMonth] = React.useState(mod.scheduledMonth ?? "");
  const [scheduledDate, setScheduledDate] = React.useState(mod.scheduledDate ?? "");
  const [scheduledTime, setScheduledTime] = React.useState(mod.scheduledTime ?? "");
  const [tz, setTz] = React.useState(mod.timezone || defaultTimezone());
  const [passPct, setPassPct] = React.useState(String(Math.round(mod.passThreshold * 100)));
  const [questionCount, setQuestionCount] = React.useState(String(mod.questionCount));
  const [timeLimit, setTimeLimit] = React.useState(mod.timeLimitMinutes != null ? String(mod.timeLimitMinutes) : "");
  const [owners, setOwners] = React.useState<string[]>(mod.ownerTeacherIds);

  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmTitle, setConfirmTitle] = React.useState("");

  const primary = owners[0];
  function toggleOwner(id: string) {
    setOwners((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function makePrimary(id: string) {
    setOwners((prev) => [id, ...prev.filter((x) => x !== id)]);
  }

  const ownersChanged =
    owners.length !== mod.ownerTeacherIds.length ||
    owners.some((id, i) => mod.ownerTeacherIds[i] !== id);

  async function handleSave() {
    if (!title.trim()) { toast.error("Title can't be empty"); return; }
    if (owners.length === 0) { toast.error("Assign at least one Department Lead"); return; }
    setSaving(true);

    const meta = await updateModuleMetadata(mod.slug, {
      number: Number(number) || mod.number,
      title: title.trim(),
      description,
      scheduledMonth: scheduledMonth || null,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      timezone: tz || null,
      passThreshold: Math.min(1, Math.max(0.01, (Number(passPct) || 85) / 100)),
      questionCount: Number(questionCount) || mod.questionCount,
      timeLimitMinutes: timeLimit.trim() ? Number(timeLimit) : null,
    });
    if (!meta.ok) { setSaving(false); toast.error(meta.error ?? "Could not save"); return; }

    if (ownersChanged) {
      const own = await updateModuleOwners(mod.slug, owners, primary);
      if (!own.ok) { setSaving(false); toast.error(own.error ?? "Saved details, but owners failed"); return; }
    }

    setSaving(false);
    toast.success("Module updated");
    setOpen(false);
    router.refresh();
  }

  async function handlePublishToggle() {
    setBusy(true);
    const res = mod.status === "published" ? await unpublishModule(mod.slug) : await publishModule(mod.slug);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not update"); return; }
    toast.success(mod.status === "published" ? "Module unpublished (set to draft)" : "Module published");
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const res = await deleteModule(mod.slug, confirmTitle);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not delete"); return; }
    toast.success("Module deleted");
    setOpen(false);
    router.push("/admin/modules");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Pencil className="mr-2 size-4" /> Edit module
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit module</SheetTitle>
          <SheetDescription>Change the module&rsquo;s details and owners. Lessons &amp; content are edited on the content page.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-number" className="text-xs">Number</Label>
              <Input id="m-number" type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-title" className="text-xs">Title</Label>
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-desc" className="text-xs">Description</Label>
            <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-month" className="text-xs">Month</Label>
              <Input id="m-month" value={scheduledMonth} onChange={(e) => setScheduledMonth(e.target.value)} placeholder="June" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-date" className="text-xs">Date</Label>
              <Input id="m-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-time" className="text-xs">Time</Label>
              <Input id="m-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-tz" className="text-xs">Time zone</Label>
            <select id="m-tz" value={tz} onChange={(e) => setTz(e.target.value)}
              className="h-10 w-full rounded-md border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-pass" className="text-xs">Pass %</Label>
              <Input id="m-pass" type="number" min={1} max={100} value={passPct} onChange={(e) => setPassPct(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-qc" className="text-xs">Questions</Label>
              <Input id="m-qc" type="number" min={1} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-time-limit" className="text-xs">Time (min)</Label>
              <Input id="m-time-limit" type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="—" className="h-10" />
            </div>
          </div>

          {/* Owners */}
          <div className="space-y-1.5">
            <Label className="text-xs">Owners (Department Leads) · star = primary</Label>
            <div className="space-y-1.5">
              {allTeachers.map((t) => {
                const sel = owners.includes(t.id);
                return (
                  <div key={t.id} className={cn("flex items-center gap-2 rounded-md border px-3 py-2", sel && "border-primary/50 bg-primary/5")}>
                    <button type="button" onClick={() => toggleOwner(t.id)} aria-pressed={sel}
                      className={cn("size-4 rounded border flex items-center justify-center shrink-0",
                        sel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
                      {sel && <span className="text-[10px] leading-none">✓</span>}
                    </button>
                    <span className="text-sm flex-1 truncate">{t.name}</span>
                    {sel && (
                      <button type="button" onClick={() => makePrimary(t.id)} title="Make primary"
                        className={cn("p-1 rounded", primary === t.id ? "text-amber-500" : "text-muted-foreground hover:text-amber-500")}>
                        <Star className={cn("size-3.5", primary === t.id && "fill-amber-500")} />
                      </button>
                    )}
                  </div>
                );
              })}
              {allTeachers.length === 0 && <p className="text-xs text-muted-foreground">No Department Leads yet.</p>}
            </div>
          </div>

          {/* Visibility — publish / unpublish */}
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Visibility</div>
                <span className="text-xs text-muted-foreground">
                  {mod.status === "published"
                    ? "Live — managers can take this module."
                    : "Draft — hidden from managers until you publish."}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handlePublishToggle} disabled={busy}>
                {mod.status === "published"
                  ? <><Undo2 className="mr-1.5 size-3.5" /> Unpublish</>
                  : <><Rocket className="mr-1.5 size-3.5" /> Publish</>}
              </Button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-md border border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/15 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Danger zone</div>

            <div className="space-y-1.5">
              <Label htmlFor="m-confirm" className="text-xs">Delete permanently — type the title to confirm</Label>
              <Input id="m-confirm" value={confirmTitle} onChange={(e) => setConfirmTitle(e.target.value)} placeholder={mod.title} className="h-9" />
              <Button type="button" variant="destructive" size="sm" className="w-full"
                onClick={handleDelete} disabled={busy || confirmTitle.trim() !== mod.title.trim()}>
                <Trash2 className="mr-1.5 size-3.5" /> Delete module
              </Button>
              <p className="text-[11px] text-muted-foreground">Only works if the module has no quiz attempts — otherwise unpublish it (set to draft) to hide it; history is kept.</p>
            </div>
          </div>
        </div>

        <SheetFooter>
          <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
