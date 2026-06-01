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
import { FileText, Plus, Users, CheckCircle2, AlertCircle, Sparkles, Upload, X as XIcon, Loader2, Bold, Italic, List, Heading2 } from "lucide-react";
import { fmtRelative } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import { createClient } from "@/lib/supabase/client";
import { uploadResourceFile } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Resource } from "@/lib/db/resources";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface EnrichedResource extends Resource {
  ackCount: { acked: number; total: number };
}

export function ResourcesAdminView({ initialResources }: { initialResources: EnrichedResource[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("General");
  const [description, setDescription] = React.useState("");
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const [requiresAck, setRequiresAck] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Lightweight markdown helpers — wrap the current selection (or insert at
  // the caret) for the toolbar buttons in the SOP editor.
  function wrapMarkdown(before: string, after = before) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = body.slice(start, end);
    const next = body.slice(0, start) + before + sel + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  }
  function prefixLines(prefix: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const next = body.slice(0, lineStart) + prefix + body.slice(lineStart);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  function resetForm() {
    setTitle(""); setDescription(""); setBody(""); setFile(null);
  }

  function handleFilesPicked(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const f = files instanceof FileList ? files[0] : files[0];
    if (f) setFile(f);
  }

  const byCategory = new Map<string, EnrichedResource[]>();
  for (const r of initialResources) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 300));
      toast.success(`Added "${title}" (demo)`);
      setSubmitting(false);
      setAddOpen(false);
      resetForm();
      return;
    }

    // Upload any attached file first; failure aborts the whole add.
    let storagePath: string | null = null;
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

    const sb = createClient();
    const { error } = await sb.from("resources").insert({
      title: title.trim(),
      category,
      description: description.trim() || null,
      body: body.trim() || null,
      storage_path: storagePath,
      requires_ack: requiresAck,
      assigned_roles: ["manager"],
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Added "${title}"`);
    setAddOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {initialResources.length} resource{initialResources.length === 1 ? "" : "s"} across {byCategory.size} categor{byCategory.size === 1 ? "y" : "ies"}
        </p>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1.5" /> Add resource
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Add a resource</SheetTitle>
              <SheetDescription>
                SOPs, policies, safety updates. Optionally require employees to acknowledge.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleAdd} className="px-4 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="r-title" className="text-xs">Title</Label>
                <Input
                  id="r-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Updated safety protocol — Oct 2026"
                  className="h-10"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-category" className="text-xs">Category</Label>
                <Input
                  id="r-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="HR / Safety / Operations / General"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-desc" className="text-xs">Short description</Label>
                <Textarea
                  id="r-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One-liner that shows on the SOP card."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* ─── File upload (drag-drop) ────────────────────────── */}
              <div className="space-y-1.5">
                <Label className="text-xs">Attach a file (PDF, Word, etc.)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFilesPicked(e.target.files)}
                />
                {file ? (
                  <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                    <FileText className="size-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-muted-foreground hover:text-rose-600 p-1"
                      aria-label="Remove file"
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFilesPicked(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
                      dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30",
                    )}
                  >
                    <Upload className="size-5 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-sm font-medium">Drop a file here or click to pick</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">PDF, Word, slides, images — anything employees need to read.</p>
                  </div>
                )}
              </div>

              {/* ─── Text editor (Markdown) ─────────────────────────── */}
              <div className="space-y-1.5">
                <Label htmlFor="r-body" className="text-xs">Or type the SOP here</Label>
                <div className="rounded-md border bg-card">
                  <div className="flex items-center gap-1 px-1.5 py-1 border-b bg-muted/40">
                    <button type="button" onClick={() => wrapMarkdown("**")} className="p-1.5 rounded hover:bg-accent" title="Bold"><Bold className="size-3.5" /></button>
                    <button type="button" onClick={() => wrapMarkdown("*")} className="p-1.5 rounded hover:bg-accent" title="Italic"><Italic className="size-3.5" /></button>
                    <button type="button" onClick={() => prefixLines("## ")} className="p-1.5 rounded hover:bg-accent" title="Heading"><Heading2 className="size-3.5" /></button>
                    <button type="button" onClick={() => prefixLines("- ")} className="p-1.5 rounded hover:bg-accent" title="Bulleted list"><List className="size-3.5" /></button>
                    <span className="ml-auto text-[10px] text-muted-foreground pr-1.5">Markdown supported</span>
                  </div>
                  <Textarea
                    id="r-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Write the full SOP here. Examples:\n\n## Section title\nThis is a paragraph.\n\n- First step\n- Second step\n\n**Important:** safety note.`}
                    rows={8}
                    className="resize-y border-0 rounded-none rounded-b-md font-mono text-sm focus-visible:ring-0"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  You can upload a file, type here, or both — employees will see all of it.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex-1">
                  <Label htmlFor="r-ack" className="text-sm font-medium">Require acknowledgement</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Employees must click &ldquo;I have read and understood&rdquo; before the resource is marked complete.
                  </p>
                </div>
                <Switch id="r-ack" checked={requiresAck} onCheckedChange={setRequiresAck} />
              </div>
            </form>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
              <Button onClick={handleAdd as unknown as React.MouseEventHandler<HTMLButtonElement>} disabled={!title.trim() || submitting}>
                {submitting ? "Adding…" : "Add resource"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {initialResources.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="size-10 mx-auto opacity-30 mb-3" />
            <div className="font-medium">No resources yet</div>
            <div className="text-sm text-muted-foreground mt-1">
              Add an SOP, safety document, or policy to get started.
            </div>
          </CardContent>
        </Card>
      )}

      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="mb-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h3>
          <Stagger className="grid lg:grid-cols-2 gap-3">
            {list.map((r) => {
              const ackPct = r.ackCount.total > 0
                ? Math.round((r.ackCount.acked / r.ackCount.total) * 100)
                : 0;
              return (
                <StaggerItem key={r.id} className="h-full">
                  <Card className="card-lift h-full">
                    <CardContent className="p-4 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{r.title}</div>
                            {r.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                              <span>v{r.version}</span>
                              <span>·</span>
                              <span>Updated {fmtRelative(r.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                        {r.requiresAck && (
                          <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                            <Sparkles className="size-2.5" /> Ack required
                          </Badge>
                        )}
                      </div>
                      {r.requiresAck && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="size-3" />
                            <span><span className="font-semibold text-foreground">{r.ackCount.acked}</span> of {r.ackCount.total} acknowledged</span>
                          </div>
                          <div className="flex items-center gap-1.5">
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
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      ))}
    </>
  );
}
