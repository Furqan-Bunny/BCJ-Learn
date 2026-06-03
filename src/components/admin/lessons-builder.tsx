"use client";

import * as React from "react";
import {
  PlayCircle, FileText, Layers, Link2, Clock, Plus, GripVertical, Trash2,
  ChevronDown, ChevronUp, Sparkles, Upload, X, FileVideo, File as FileIcon,
  Pencil, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Lesson, LessonContent, ContentType } from "@/types";
import { uploadModuleContentResumable } from "@/lib/supabase/storage";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Per-type upload size ceilings. Videos can be large; documents/slides should not.
const SIZE_LIMITS: Record<ContentType, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  document: 50 * 1024 * 1024, // 50 MB
  slides: 50 * 1024 * 1024, // 50 MB
  link: 0,
};

type UploadStatus = "idle" | "uploading" | "done" | "error";
interface FileUploadState {
  status: UploadStatus;
  pct: number;
  error?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const CONTENT_META: Record<ContentType, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string; }> = {
  video:    { label: "Video",    icon: PlayCircle, tint: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40" },
  document: { label: "Document", icon: FileText,   tint: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40" },
  slides:   { label: "Slides",   icon: Layers,     tint: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" },
  link:     { label: "Link",     icon: Link2,      tint: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40" },
};

let _id = 0;
function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${++_id}`;
}

export function emptyLesson(moduleSlug: string, order: number): Lesson {
  return {
    id: newId("lesson"),
    moduleSlug,
    order,
    title: "",
    description: "",
    durationMinutes: 30,
    contents: [],
  };
}

interface LessonsBuilderProps {
  lessons: Lesson[];
  onChange: (lessons: Lesson[]) => void;
  moduleSlug: string;
}

export function LessonsBuilder({ lessons, onChange, moduleSlug }: LessonsBuilderProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(lessons[0]?.id ?? null);
  const [contentDialogFor, setContentDialogFor] = React.useState<{ lessonId: string; type: ContentType } | null>(null);
  const [editContentFor, setEditContentFor] = React.useState<{ lessonId: string; content: LessonContent } | null>(null);

  const totalMinutes = lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0);

  function addLesson() {
    const next = [...lessons, emptyLesson(moduleSlug, lessons.length + 1)];
    onChange(next);
    setExpandedId(next[next.length - 1].id);
  }

  function updateLesson(id: string, patch: Partial<Lesson>) {
    onChange(lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function deleteLesson(id: string) {
    onChange(lessons.filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i + 1 })));
  }

  function moveLesson(id: string, direction: -1 | 1) {
    const idx = lessons.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;
    const reordered = [...lessons];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, item);
    onChange(reordered.map((l, i) => ({ ...l, order: i + 1 })));
  }

  function addContent(lessonId: string, content: LessonContent) {
    onChange(
      lessons.map((l) =>
        l.id === lessonId ? { ...l, contents: [...l.contents, content] } : l,
      ),
    );
  }

  function removeContent(lessonId: string, contentId: string) {
    onChange(
      lessons.map((l) =>
        l.id === lessonId ? { ...l, contents: l.contents.filter((c) => c.id !== contentId) } : l,
      ),
    );
  }

  function updateContent(lessonId: string, contentId: string, patch: Partial<LessonContent>) {
    onChange(
      lessons.map((l) =>
        l.id === lessonId
          ? { ...l, contents: l.contents.map((c) => (c.id === contentId ? { ...c, ...patch } : c)) }
          : l,
      ),
    );
  }

  function moveContent(lessonId: string, contentId: string, direction: -1 | 1) {
    onChange(
      lessons.map((l) => {
        if (l.id !== lessonId) return l;
        const idx = l.contents.findIndex((c) => c.id === contentId);
        if (idx < 0) return l;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= l.contents.length) return l;
        const reordered = [...l.contents];
        const [item] = reordered.splice(idx, 1);
        reordered.splice(targetIdx, 0, item);
        return { ...l, contents: reordered };
      }),
    );
  }

  return (
    <div className="space-y-3">
      {/* Header strip with summary */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{lessons.length}</span> lessons ·
          <span className="font-semibold text-foreground"> {totalMinutes}</span> min total
        </div>
        <Button size="sm" variant="outline" onClick={addLesson}>
          <Plus className="size-3.5 mr-1.5" /> Add lesson
        </Button>
      </div>

      {lessons.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
          <Layers className="size-8 mx-auto mb-2 opacity-40" />
          <div className="font-medium text-foreground">No lessons yet</div>
          <div className="text-sm mt-1">Add a lesson to organize the seminar content.</div>
          <Button size="sm" className="mt-4" onClick={addLesson}>
            <Plus className="size-3.5 mr-1.5" /> Add the first lesson
          </Button>
        </div>
      )}

      {lessons.map((lesson, i) => {
        const expanded = expandedId === lesson.id;
        return (
          <div key={lesson.id} className="rounded-lg border bg-card overflow-hidden">
            {/* Lesson header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
              <div className="flex flex-col -gap-1 shrink-0">
                <button
                  onClick={() => moveLesson(lesson.id, -1)}
                  disabled={i === 0}
                  className="size-4 rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3" />
                </button>
                <button
                  onClick={() => moveLesson(lesson.id, 1)}
                  disabled={i === lessons.length - 1}
                  className="size-4 rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3" />
                </button>
              </div>
              <Badge variant="secondary" className="font-mono">L{lesson.order}</Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {lesson.title || <span className="text-muted-foreground italic">Untitled lesson</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lesson.contents.length} items · {lesson.durationMinutes} min
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpandedId(expanded ? null : lesson.id)}
              >
                {expanded ? "Collapse" : "Edit"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteLesson(lesson.id)}
                className="size-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                aria-label="Delete lesson"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            {/* Expanded body */}
            {expanded && (
              <div className="p-4 space-y-4 border-t">
                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lesson title</Label>
                    <Input
                      value={lesson.title}
                      onChange={(e) => updateLesson(lesson.id, { title: e.target.value })}
                      placeholder="e.g., Daily Rhythm & Walkthroughs"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      <Clock className="size-3 inline mr-1" /> Minutes
                    </Label>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={lesson.durationMinutes}
                      onChange={(e) => updateLesson(lesson.id, { durationMinutes: Number(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={lesson.description}
                    onChange={(e) => updateLesson(lesson.id, { description: e.target.value })}
                    placeholder="One sentence on what this lesson covers."
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Content items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Content items</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="size-3.5 mr-1.5" /> Add content
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {(Object.entries(CONTENT_META) as [ContentType, typeof CONTENT_META[ContentType]][]).map(([type, meta]) => {
                          const Icon = meta.icon;
                          return (
                            <DropdownMenuItem
                              key={type}
                              onClick={() => setContentDialogFor({ lessonId: lesson.id, type })}
                            >
                              <span className={cn("size-5 rounded flex items-center justify-center mr-2", meta.tint)}>
                                <Icon className="size-3" />
                              </span>
                              {meta.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {lesson.contents.length === 0 ? (
                    <div className="rounded-md border-2 border-dashed p-5 text-center text-xs text-muted-foreground">
                      No content yet. Add a video, document, slide deck, or external link.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {lesson.contents.map((c, ci) => {
                        const meta = CONTENT_META[c.type];
                        const Icon = meta.icon;
                        return (
                          <div key={c.id} className="flex items-center gap-2 px-2 py-2 rounded border bg-card">
                            <div className="flex flex-col shrink-0">
                              <button
                                onClick={() => moveContent(lesson.id, c.id, -1)}
                                disabled={ci === 0}
                                className="size-4 rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                              >
                                <ChevronUp className="size-3" />
                              </button>
                              <button
                                onClick={() => moveContent(lesson.id, c.id, 1)}
                                disabled={ci === lesson.contents.length - 1}
                                className="size-4 rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
                              >
                                <ChevronDown className="size-3" />
                              </button>
                            </div>
                            <div className={cn("size-7 rounded flex items-center justify-center shrink-0", meta.tint)}>
                              <Icon className="size-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                {c.title}
                                {c.presentationHidden && (
                                  <Badge variant="outline" className="text-[9px] gap-0.5 px-1 py-0 shrink-0 text-muted-foreground">
                                    <EyeOff className="size-2.5" /> Not on presentation day
                                  </Badge>
                                )}
                              </div>
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
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateContent(lesson.id, c.id, { presentationHidden: !c.presentationHidden })}
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title={c.presentationHidden ? "Show on presentation day" : "Hide on presentation day"}
                              aria-label={c.presentationHidden ? "Show on presentation day" : "Hide on presentation day"}
                            >
                              {c.presentationHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditContentFor({ lessonId: lesson.id, content: c })}
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Edit"
                              aria-label="Edit content"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeContent(lesson.id, c.id)}
                              className="size-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Content dialog */}
      <AddContentDialog
        open={!!contentDialogFor}
        type={contentDialogFor?.type ?? null}
        moduleSlug={moduleSlug}
        lessonId={contentDialogFor?.lessonId ?? ""}
        onCancel={() => setContentDialogFor(null)}
        onSubmit={(content) => {
          if (contentDialogFor) {
            addContent(contentDialogFor.lessonId, content);
            setContentDialogFor(null);
          }
        }}
      />

      {/* Edit Content dialog */}
      <EditContentDialog
        open={!!editContentFor}
        content={editContentFor?.content ?? null}
        onCancel={() => setEditContentFor(null)}
        onSave={(patch) => {
          if (editContentFor) {
            updateContent(editContentFor.lessonId, editContentFor.content.id, patch);
            setEditContentFor(null);
          }
        }}
      />
    </div>
  );
}

// ─── Edit Content dialog ───────────────────────────────────────────────
// Lightweight metadata editor — title, duration, presentation-day visibility,
// and (for link/video URLs) the external/embed URL. File replacement is done
// by removing the item and re-adding (keeps the upload flow in one place).
function EditContentDialog({
  open,
  content,
  onCancel,
  onSave,
}: {
  open: boolean;
  content: LessonContent | null;
  onCancel: () => void;
  onSave: (patch: Partial<LessonContent>) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [duration, setDuration] = React.useState<number>(5);
  const [url, setUrl] = React.useState("");
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (open && content) {
      setTitle(content.title);
      setDuration(content.durationMinutes ?? 5);
      setUrl(content.externalUrl ?? content.videoUrl ?? "");
      setHidden(!!content.presentationHidden);
    }
  }, [open, content]);

  if (!content) return null;
  const meta = CONTENT_META[content.type];
  const Icon = meta.icon;
  const hasUrl = content.type === "link" || (content.type === "video" && !content.storagePath);

  function handleSave() {
    const patch: Partial<LessonContent> = {
      title: title.trim() || content!.title,
      durationMinutes: duration,
      presentationHidden: hidden,
    };
    if (hasUrl && url.trim()) {
      if (content!.type === "link") patch.externalUrl = url.trim();
      else patch.videoUrl = url.trim();
    }
    onSave(patch);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("size-7 rounded flex items-center justify-center", meta.tint)}>
              <Icon className="size-4" />
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Edit {meta.label}</Badge>
          </div>
          <DialogTitle>Edit content</DialogTitle>
          <DialogDescription>
            Update the title, duration{hasUrl ? ", URL" : ""}, and whether it shows on presentation day.
            {content.fileName && " To swap the file, remove this item and add it again."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
          </div>
          {hasUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs">{content.type === "video" ? "YouTube / Vimeo URL" : "URL"}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="h-10" />
            </div>
          )}
          <div className="space-y-1.5 w-40">
            <Label className="text-xs"><Clock className="size-3 inline mr-1" /> Duration (min)</Label>
            <Input type="number" min={1} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-10" />
          </div>
          <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/30">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <div className="flex-1">
              <div className="text-sm font-medium flex items-center gap-1.5">
                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} Don&rsquo;t show on presentation day
              </div>
              <div className="text-[11px] text-muted-foreground">
                Employees can still review it as optional pre-study material.
              </div>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Content dialog ────────────────────────────────────────────────
type Source = "upload" | "url";

const ACCEPTED: Record<ContentType, { exts: string; hint: string; mockExt: string }> = {
  video:    { exts: ".mp4,.mov,.webm,.mkv",                                   hint: "MP4 · MOV · WebM · max 2 GB",  mockExt: "mp4" },
  document: { exts: ".doc,.docx,.pdf,.md,.txt",                               hint: "Word · PDF · Markdown",        mockExt: "docx" },
  slides:   { exts: ".ppt,.pptx,.key,.pdf",                                   hint: "PowerPoint · Keynote · PDF",   mockExt: "pptx" },
  link:     { exts: "",                                                       hint: "",                              mockExt: "" },
};

function AddContentDialog({
  open,
  type,
  moduleSlug,
  lessonId,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  type: ContentType | null;
  moduleSlug: string;
  lessonId: string;
  onCancel: () => void;
  onSubmit: (c: LessonContent) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [duration, setDuration] = React.useState<number>(5);
  const [source, setSource] = React.useState<Source>("upload");
  const [url, setUrl] = React.useState("");

  // Multi-file upload
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadStates, setUploadStates] = React.useState<Map<File, FileUploadState>>(new Map());
  const pathByFile = React.useRef<Map<File, string | undefined>>(new Map());
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDuration(type === "video" ? 5 : type === "document" ? 6 : type === "slides" ? 8 : 2);
      setUrl("");
      setFiles([]);
      setUploadStates(new Map());
      pathByFile.current = new Map();
      // Default source: upload for files, url for link
      setSource(type === "link" ? "url" : "upload");
    }
  }, [open, type]);

  if (!type) return null;

  const meta = CONTENT_META[type];
  const Icon = meta.icon;
  const canMultiple = type === "video" || type === "document" || type === "slides";
  const accept = ACCEPTED[type];

  function pickFiles() {
    inputRef.current?.click();
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Reject files that are too big or the wrong type before they're queued.
  function validateFile(f: File): string | null {
    const limit = SIZE_LIMITS[type!];
    if (limit && f.size > limit) {
      return `${f.name} is too large (max ${fmtSize(limit)}).`;
    }
    const exts = accept.exts
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (exts.length > 0) {
      const lower = f.name.toLowerCase();
      if (!exts.some((ext) => lower.endsWith(ext))) {
        return `${f.name} isn't an accepted file type (${accept.hint}).`;
      }
    }
    return null;
  }

  function handleFileList(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const valid: File[] = [];
    for (const f of incoming) {
      const err = validateFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;
    setFiles((prev) => (canMultiple ? [...prev, ...valid] : valid.slice(0, 1)));
    if (!title && valid[0]) {
      const base = valid[0].name.replace(/\.[^/.]+$/, "");
      setTitle(base.replace(/[-_]+/g, " "));
    }
  }

  function removeFile(idx: number) {
    setFiles((arr) => {
      const target = arr[idx];
      if (target) {
        setUploadStates((prev) => {
          const next = new Map(prev);
          next.delete(target);
          return next;
        });
        pathByFile.current.delete(target);
      }
      return arr.filter((_, i) => i !== idx);
    });
  }

  function setFileState(f: File, state: FileUploadState) {
    setUploadStates((prev) => new Map(prev).set(f, state));
  }

  // Upload one file with real progress + retry. Demo mode simulates progress so
  // the UX can be exercised without storage credentials.
  async function uploadFile(f: File): Promise<{ ok: boolean; path?: string }> {
    setFileState(f, { status: "uploading", pct: 0 });
    if (DEMO_MODE) {
      for (const p of [25, 55, 80, 100]) {
        await sleep(140);
        setFileState(f, { status: "uploading", pct: p });
      }
      setFileState(f, { status: "done", pct: 100 });
      pathByFile.current.set(f, undefined);
      return { ok: true, path: undefined };
    }
    try {
      const { path } = await uploadModuleContentResumable(moduleSlug, lessonId, f, {
        onProgress: (pct) => setFileState(f, { status: "uploading", pct }),
      });
      setFileState(f, { status: "done", pct: 100 });
      pathByFile.current.set(f, path);
      return { ok: true, path };
    } catch (err) {
      setFileState(f, { status: "error", pct: 0, error: (err as Error).message });
      return { ok: false };
    }
  }

  function buildContent(f: File, index: number): LessonContent {
    const baseTitle = title.trim();
    const t = files.length > 1 ? `${baseTitle} (${index + 1})` : baseTitle;
    const path = pathByFile.current.get(f);
    const content: LessonContent = {
      id: newId("content"),
      type: type!,
      title: t,
      durationMinutes: duration,
      fileName: f.name,
      fileSize: fmtSize(f.size),
      storagePath: path,
    };
    if (type === "document") {
      content.documentPages = [`# ${t}\n\nDocument uploaded.`];
    } else if (type === "slides") {
      content.slides = [{ title: t, bullets: ["Uploaded slides — preview opens via signed URL."] }];
    } else if (type === "video" && !path) {
      content.videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    }
    return content;
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    // URL-only types short-circuit immediately.
    if (type === "link") {
      const id = newId("content");
      onSubmit({
        id,
        type: "link",
        title: title.trim(),
        durationMinutes: duration,
        externalUrl: url || "https://example.com",
      });
      return;
    }
    if (source === "url") {
      // YouTube/Vimeo URL — no upload needed.
      const id = newId("content");
      const base: LessonContent = {
        id,
        type: type!,
        title: title.trim(),
        durationMinutes: duration,
      };
      if (type === "video") {
        base.videoUrl = url || "https://www.youtube.com/embed/dQw4w9WgXcQ";
      }
      onSubmit(base);
      return;
    }

    // Upload path — upload each not-yet-done file (skip ones already uploaded
    // on a previous attempt), then emit a LessonContent for every file.
    setUploading(true);
    let allOk = true;
    for (const f of files) {
      if (uploadStates.get(f)?.status === "done") continue;
      const r = await uploadFile(f);
      if (!r.ok) allOk = false;
    }
    setUploading(false);

    if (!allOk) {
      toast.error("Some files didn't upload. Retry them or remove them, then add again.");
      return;
    }

    files.forEach((f, i) => onSubmit(buildContent(f, i)));
  }

  const anyUploading =
    uploading || Array.from(uploadStates.values()).some((s) => s.status === "uploading");

  const canSubmit = (() => {
    if (!title.trim()) return false;
    if (type === "link") return url.trim().length > 0;
    if (source === "upload") return files.length > 0;
    if (source === "url")    return url.trim().length > 0;
    return false;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("size-7 rounded flex items-center justify-center", meta.tint)}>
              <Icon className="size-4" />
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Add {meta.label}
            </Badge>
          </div>
          <DialogTitle>New {meta.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {type === "video" && "Upload one or more MP4 files, or paste a YouTube / Vimeo URL."}
            {type === "document" && "Upload one or more Word docs or PDFs."}
            {type === "slides" && "Upload one or more PowerPoint or Keynote decks."}
            {type === "link" && "An external URL — opens in a new tab."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Source switcher (not for link) */}
          {type !== "link" && (
            <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <Upload className="size-3.5" /> Upload file{canMultiple ? "s" : ""}
                </TabsTrigger>
                <TabsTrigger value="url" className="flex-1 gap-1.5">
                  <Link2 className="size-3.5" /> Paste URL
                </TabsTrigger>
              </TabsList>

              {/* Upload tab */}
              <TabsContent value="upload" className="mt-3 space-y-2">
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={accept.exts}
                  multiple={canMultiple}
                  onChange={(e) => { handleFileList(e.target.files); e.target.value = ""; }}
                />

                <div
                  onClick={pickFiles}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFileList(e.dataTransfer.files);
                  }}
                  className={cn(
                    "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-accent/30",
                  )}
                >
                  <div className={cn("size-10 mx-auto rounded-lg flex items-center justify-center mb-2", meta.tint)}>
                    {type === "video" ? <FileVideo className="size-5" /> : <FileIcon className="size-5" />}
                  </div>
                  <div className="text-sm font-medium">
                    {dragOver ? "Drop to upload" : `Drop ${canMultiple ? "files" : "file"} here, or `}
                    {!dragOver && (
                      <button type="button" className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); pickFiles(); }}>
                        browse
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{accept.hint}</div>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((f, i) => {
                      const st = uploadStates.get(f);
                      return (
                        <div key={i} className="px-3 py-2 rounded-md border bg-card">
                          <div className="flex items-center gap-2">
                            <div className={cn("size-8 rounded flex items-center justify-center shrink-0", meta.tint)}>
                              {type === "video" ? <FileVideo className="size-3.5" /> : <FileIcon className="size-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{f.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {fmtSize(f.size)}
                                {st?.status === "done" && <span className="text-emerald-600 dark:text-emerald-400"> · Uploaded</span>}
                                {st?.status === "uploading" && <span> · {st.pct}%</span>}
                              </div>
                            </div>
                            {st?.status === "error" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => uploadFile(f)}
                              >
                                <RotateCcw className="size-3.5" /> Retry
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => removeFile(i)}
                              disabled={st?.status === "uploading"}
                              aria-label="Remove file"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                          {st?.status === "uploading" && (
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={st.pct} aria-valuemin={0} aria-valuemax={100}>
                              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${st.pct}%` }} />
                            </div>
                          )}
                          {st?.status === "error" && (
                            <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">{st.error ?? "Upload failed."}</p>
                          )}
                        </div>
                      );
                    })}
                    {canMultiple && files.length > 1 && (
                      <p className="text-[11px] text-muted-foreground px-1">
                        {files.length} files will be added to the lesson as {files.length} separate items.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* URL tab */}
              <TabsContent value="url" className="mt-3 space-y-1.5">
                <Label className="text-xs">{type === "video" ? "YouTube / Vimeo URL" : "URL"}</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={type === "video" ? "https://youtube.com/watch?v=…" : "https://…"}
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">
                  {type === "video"
                    ? "Public YouTube / Vimeo videos work best. The video will embed in the presenter."
                    : "Paste any web URL."}
                </p>
              </TabsContent>
            </Tabs>
          )}

          {/* Link-only URL field (no tabs needed) */}
          {type === "link" && (
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="h-10"
              />
            </div>
          )}

          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "video" ? "e.g., Walkthrough demo with VP Ops" :
                  type === "document" ? "e.g., The Daily Rhythm" :
                  type === "slides" ? "e.g., Briefings & Walkthrough slides" :
                  "e.g., BCJ field-ops checklist"
                }
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                <Clock className="size-3 inline mr-1" /> Duration
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="h-10 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
              </div>
            </div>
          </div>

          {type === "video" && (
            <div className="rounded-md border bg-[var(--ai)]/5 border-[var(--ai)]/30 p-3 flex items-start gap-2">
              <Sparkles className="size-3.5 text-[var(--ai)] mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Once uploaded, AI can transcribe the video and use the transcript as source material for quiz questions.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={anyUploading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || anyUploading}>
            {anyUploading ? (
              <><Loader2 className="size-4 animate-spin mr-1.5" /> Uploading…</>
            ) : canMultiple && source === "upload" && files.length > 1
              ? `Add ${files.length} items to lesson`
              : "Add to lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
