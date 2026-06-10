"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { FileText, Plus, Users, CheckCircle2, AlertCircle, Sparkles, Upload, X as XIcon, Bold, Italic, List, Heading2, Pencil, Trash2, ChevronDown, Loader2, Circle, ArrowRight, Folder, FolderOpen } from "lucide-react";
import { fmtRelative, fmtDate } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import { uploadResourceFile } from "@/lib/supabase/storage";
import { createResource, editResource, deleteResource, getAcknowledgementStatus } from "@/lib/server/resource-actions";
import { backfillContentSpanish } from "@/lib/server/ai-actions";
import type { AckStatusRow } from "@/lib/db/resources";
import { MARKETS } from "@/types/markets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import type { Resource } from "@/lib/db/resources";
import type { Role } from "@/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "manager", label: "Employees" },
  { value: "teacher", label: "Department Leads" },
  { value: "admin", label: "Admins" },
];

interface EnrichedResource extends Resource {
  ackCount: { acked: number; total: number };
}

export function ResourcesAdminView({ initialResources }: { initialResources: EnrichedResource[] }) {
  const router = useRouter();

  const [backfilling, setBackfilling] = React.useState(false);

  async function handleTranslateAll() {
    setBackfilling(true);
    const toastId = "content-translate";
    toast.loading("Translating module, lesson and resource titles to Spanish…", { id: toastId });
    const res = await backfillContentSpanish();
    setBackfilling(false);
    if (!res.ok) {
      toast.error(res.error ?? "Translation failed", { id: toastId });
      return;
    }
    toast.success(
      res.translated ? `Translated ${res.translated} item(s) to Spanish` : "Everything is already translated",
      { id: toastId },
    );
    router.refresh();
  }

  // Sheet is dual-mode: editingId === null → create, otherwise edit that id.
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("General");
  const [department, setDepartment] = React.useState("General");
  const [description, setDescription] = React.useState("");
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [existingPath, setExistingPath] = React.useState<string | null>(null);
  const [externalUrl, setExternalUrl] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [requiresAck, setRequiresAck] = React.useState(true);
  const [signupAck, setSignupAck] = React.useState(false);
  const [assignedRoles, setAssignedRoles] = React.useState<Role[]>(["manager"]);
  const [markets, setMarkets] = React.useState<string[]>([]); // [] = all markets
  const [notifyOnUpdate, setNotifyOnUpdate] = React.useState(true);
  const [requireReack, setRequireReack] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<EnrichedResource | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function wrapMarkdown(before: string, after = before) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = body.slice(start, end);
    setBody(body.slice(0, start) + before + sel + after + body.slice(end));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + before.length, end + before.length); });
  }
  function prefixLines(prefix: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    setBody(body.slice(0, lineStart) + prefix + body.slice(lineStart));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length); });
  }

  function openCreate() {
    setEditingId(null);
    setTitle(""); setCategory("General"); setDepartment("General"); setDescription(""); setBody("");
    setFile(null); setExistingPath(null); setExternalUrl("");
    setRequiresAck(true); setSignupAck(false); setAssignedRoles(["manager"]); setMarkets([]);
    setNotifyOnUpdate(true); setRequireReack(false);
    setSheetOpen(true);
  }
  function openEdit(r: EnrichedResource) {
    setEditingId(r.id);
    setTitle(r.title); setCategory(r.category); setDepartment(r.department ?? "General"); setDescription(r.description ?? ""); setBody(r.body ?? "");
    setFile(null); setExistingPath(r.storagePath ?? null); setExternalUrl(r.externalUrl ?? "");
    setRequiresAck(r.requiresAck); setSignupAck(r.signupAck); setAssignedRoles(r.assignedRoles?.length ? r.assignedRoles : ["manager"]);
    setMarkets(r.assignedCohorts ?? []); setNotifyOnUpdate(r.notifyOnUpdate); setRequireReack(false);
    setSheetOpen(true);
  }

  // Open the edit sheet when arriving from the detail page (?edit=<id>).
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const r = initialResources.find((x) => x.id === editId);
    if (r) openEdit(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialResources]);

  function toggleRole(role: Role) {
    setAssignedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }
  function toggleMarket(m: string) {
    setMarkets((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function handleFilesPicked(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const f = files instanceof FileList ? files[0] : files[0];
    if (f) setFile(f);
  }

  // Group into department "folders".
  const byDepartment = new Map<string, EnrichedResource[]>();
  for (const r of initialResources) {
    const dept = r.department || "General";
    const list = byDepartment.get(dept) ?? [];
    list.push(r);
    byDepartment.set(dept, list);
  }
  const departmentNames = Array.from(byDepartment.keys());

  // Collapsible folders. Default: open the first department so something shows.
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setOpenFolders((prev) => (prev.size ? prev : new Set(departmentNames.slice(0, 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentNames.join("|")]);
  function toggleFolder(d: string) {
    setOpenFolders((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
  }

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    if (e && "preventDefault" in e) e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (assignedRoles.length === 0) { toast.error("Pick at least one audience"); return; }
    setSubmitting(true);

    // Upload a newly-picked file; otherwise keep the existing path.
    let storagePath: string | null = existingPath;
    if (file) {
      try {
        const { path } = await uploadResourceFile(file);
        storagePath = path;
      } catch (err) {
        setSubmitting(false);
        toast.error((err as Error)?.message ?? "File upload failed");
        return;
      }
    }

    const payload = {
      title: title.trim(),
      category: category.trim() || "General",
      department: department.trim() || "General",
      description: description.trim() || null,
      body: body.trim() || null,
      storagePath,
      externalUrl: externalUrl.trim() || null,
      requiresAck,
      signupAck,
      assignedRoles,
      assignedCohorts: markets.length ? markets : null,
      notifyOnUpdate,
    };

    const result = editingId
      ? await editResource(editingId, { ...payload, requireReack })
      : await createResource(payload);
    setSubmitting(false);

    if (!result.ok) { toast.error(result.error ?? "Could not save"); return; }
    toast.success(editingId ? `Updated "${title.trim()}"` : `Added "${title.trim()}"`);
    setSheetOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteResource(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) { toast.error(result.error ?? "Could not delete"); return; }
    toast.success(`Deleted "${deleteTarget.title}"`);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {initialResources.length} resource{initialResources.length === 1 ? "" : "s"} across {byDepartment.size} department{byDepartment.size === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTranslateAll} disabled={backfilling}>
            {backfilling ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5 text-[var(--ai)]" />}
            {backfilling ? "Translating…" : "Translate all to Spanish"}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> Add resource
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit resource" : "Add a resource"}</SheetTitle>
            <SheetDescription>
              Resources, policies, safety updates. Choose who sees it and whether they must acknowledge.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-title" className="text-xs">Title</Label>
              <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Floor care guide" className="h-10" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-department" className="text-xs">Department</Label>
                <Input id="r-department" value={department} onChange={(e) => setDepartment(e.target.value)}
                  placeholder="HR / Operations / Safety" className="h-10" list="dept-suggestions" />
                <datalist id="dept-suggestions">
                  {Array.from(byDepartment.keys()).map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-category" className="text-xs">Category</Label>
                <Input id="r-category" value={category} onChange={(e) => setCategory(e.target.value)}
                  placeholder="Policy / Safety / Guide" className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-desc" className="text-xs">Short description</Label>
              <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="One-liner that shows on the resource card." rows={2} className="resize-none" />
            </div>

            {/* Audience: roles + markets */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Users className="size-3" /> Who sees this</Label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const sel = assignedRoles.includes(r.value);
                  return (
                    <button key={r.value} type="button" onClick={() => toggleRole(r.value)} aria-pressed={sel}
                      className={cn("px-3 h-9 rounded-md border text-sm transition-colors",
                        sel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Markets <span className="text-muted-foreground/70 font-normal">(none = all markets)</span></Label>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map((m) => {
                  const sel = markets.includes(m);
                  return (
                    <button key={m} type="button" onClick={() => toggleMarket(m)} aria-pressed={sel}
                      className={cn("px-3 h-9 rounded-md border text-sm transition-colors",
                        sel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-1.5">
              <Label className="text-xs">Attach a file (PDF, Word, etc.)</Label>
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFilesPicked(e.target.files)} />
              {file || existingPath ? (
                <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <FileText className="size-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file ? file.name : "Current attachment"}</div>
                    <div className="text-[11px] text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Keep, or pick a new file to replace"}</div>
                  </div>
                  <button type="button" onClick={() => { setFile(null); setExistingPath(null); }}
                    className="text-muted-foreground hover:text-rose-600 p-1" aria-label="Remove file">
                    <XIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesPicked(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn("rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
                    dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30")}>
                  <Upload className="size-5 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-sm font-medium">Drop a file here or click to pick</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">PDF, Word, slides, images.</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-url" className="text-xs">Or link to an external doc (optional)</Label>
              <Input id="r-url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…" className="h-10" />
            </div>

            {/* Markdown body */}
            <div className="space-y-1.5">
              <Label htmlFor="r-body" className="text-xs">Or type the resource here</Label>
              <div className="rounded-md border bg-card">
                <div className="flex items-center gap-1 px-1.5 py-1 border-b bg-muted/40">
                  <button type="button" onClick={() => wrapMarkdown("**")} className="p-1.5 rounded hover:bg-accent" title="Bold"><Bold className="size-3.5" /></button>
                  <button type="button" onClick={() => wrapMarkdown("*")} className="p-1.5 rounded hover:bg-accent" title="Italic"><Italic className="size-3.5" /></button>
                  <button type="button" onClick={() => prefixLines("## ")} className="p-1.5 rounded hover:bg-accent" title="Heading"><Heading2 className="size-3.5" /></button>
                  <button type="button" onClick={() => prefixLines("- ")} className="p-1.5 rounded hover:bg-accent" title="Bulleted list"><List className="size-3.5" /></button>
                  <span className="ml-auto text-[10px] text-muted-foreground pr-1.5">Markdown supported</span>
                </div>
                <Textarea id="r-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)}
                  placeholder={"## Section\nText…\n\n- Step one\n- Step two"} rows={7}
                  className="resize-y border-0 rounded-none rounded-b-md font-mono text-sm focus-visible:ring-0" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex-1">
                <Label htmlFor="r-ack" className="text-sm font-medium">Require acknowledgement</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {signupAck ? "Required automatically by the sign-up gate below." : "Employees must confirm they’ve read it."}
                </p>
              </div>
              <Switch id="r-ack" checked={requiresAck} onCheckedChange={setRequiresAck} disabled={signupAck} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/[0.03] p-3">
              <div className="flex-1">
                <Label htmlFor="r-signup" className="text-sm font-medium">Require at sign-up (onboarding)</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">New users must read &amp; acknowledge this before they can use the app.</p>
              </div>
              <Switch
                id="r-signup"
                checked={signupAck}
                onCheckedChange={(v) => { setSignupAck(v); if (v) setRequiresAck(true); }}
              />
            </div>

            {editingId && (
              <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                <div className="flex-1">
                  <Label htmlFor="r-reack" className="text-sm font-medium">Require re-acknowledgement</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Bumps the version — everyone must sign again and gets notified.</p>
                </div>
                <Switch id="r-reack" checked={requireReack} onCheckedChange={setRequireReack} />
              </div>
            )}
          </form>
          <SheetFooter>
            <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
            <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
              {submitting ? "Saving…" : editingId ? "Save changes" : "Add resource"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {initialResources.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="size-10 mx-auto opacity-30 mb-3" />
            <div className="font-medium">No resources yet</div>
            <div className="text-sm text-muted-foreground mt-1">Add a resource, safety document, or policy to get started.</div>
          </CardContent>
        </Card>
      )}

      {Array.from(byDepartment.entries()).map(([dept, list]) => {
        const open = openFolders.has(dept);
        return (
        <div key={dept} className="mb-3 rounded-lg border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleFolder(dept)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
          >
            <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {open ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{dept}</div>
              <div className="text-[11px] text-muted-foreground">{list.length} resource{list.length === 1 ? "" : "s"}</div>
            </div>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
          {open && (
          <Stagger className="grid lg:grid-cols-2 gap-3 p-3 border-t bg-muted/20">
            {list.map((r) => (
              <StaggerItem key={r.id} className="h-full">
                <Card className="card-lift h-full">
                  <CardContent className="p-4 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/resources/${r.id}`} className="flex items-start gap-3 flex-1 min-w-0 group">
                        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate group-hover:text-primary transition-colors">{r.title}</div>
                          {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                            <span>v{r.version}</span><span>·</span><span>Updated {fmtRelative(r.updatedAt)}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        {r.requiresAck && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Sparkles className="size-2.5" /> Acknowledgement required
                          </Badge>
                        )}
                        <button type="button" onClick={() => openEdit(r)} title="Edit"
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(r)} title="Delete"
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {r.requiresAck && (
                      <Link
                        href={`/admin/resources/${r.id}`}
                        className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Users className="size-3" />
                          <span><span className="font-semibold text-foreground">{r.ackCount.acked}</span> of {r.ackCount.total} acknowledged</span>
                        </span>
                        <span className="text-primary inline-flex items-center gap-1">View all details <ArrowRight className="size-3" /></span>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          )}
        </div>
        );
      })}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed and unlinked from any modules. Past acknowledgements are kept for the record. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Expandable ack summary: shows count/percentage, expands to per-user acked/pending list. */
function AckDrilldown({ resourceId, acked, total, ackPct }: { resourceId: string; acked: number; total: number; ackPct: number }) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<AckStatusRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null && !loading) {
      setLoading(true);
      const res = await getAcknowledgementStatus(resourceId);
      setLoading(false);
      if (res.ok) setRows(res.rows);
      else toast.error(res.error);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t text-xs">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3" />
          <span><span className="font-semibold text-foreground">{acked}</span> of {total} acknowledged</span>
          <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        </span>
        <span className="flex items-center gap-1.5">
          {ackPct === 100 ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 gap-1">
              <CheckCircle2 className="size-2.5" /> Complete
            </Badge>
          ) : ackPct > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">{ackPct}%</span>
          ) : (
            <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
              <AlertCircle className="size-2.5" /> Awaiting
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-md border bg-muted/20 max-h-56 overflow-y-auto divide-y">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground"><Loader2 className="size-4 animate-spin mx-auto" /></div>
          ) : !rows || rows.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No one is assigned this resource.</div>
          ) : (
            rows.map((u) => (
              <div key={u.userId} className="flex items-center gap-2 px-3 py-1.5">
                {u.acked ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate font-medium">{u.name}</span>
                <span className={cn("text-[10px] shrink-0 text-right", u.acked ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {u.acked
                    ? (u.acknowledgedAt ? fmtDate(u.acknowledgedAt, "MMM d · h:mm a") : "Acknowledged")
                    : "Pending"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
