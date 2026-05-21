"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlayCircle, FileText, Layers, Link2, Clock, Download, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonContent, ContentType } from "@/types";
import { signedUrlForContent } from "@/lib/supabase/storage";
import { saveVideoProgress, getVideoProgress } from "@/lib/server/progress-actions";

const TYPE_META: Record<ContentType, { icon: React.ComponentType<{ className?: string }>; label: string; tint: string }> = {
  video:    { icon: PlayCircle, label: "Video",    tint: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40" },
  document: { icon: FileText,   label: "Document", tint: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40" },
  slides:   { icon: Layers,     label: "Slides",   tint: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" },
  link:     { icon: Link2,      label: "Link",     tint: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40" },
};

interface ContentViewerProps {
  content: LessonContent | null;
  onClose: () => void;
  moduleSlug?: string;
}

/** Read-only viewer used by managers for OPTIONAL pre-study (per scope §5.1.3). */
export function ContentViewer({ content, onClose, moduleSlug }: ContentViewerProps) {
  // External links open in a new tab — no need for a modal
  React.useEffect(() => {
    if (content && content.type === "link" && content.externalUrl) {
      window.open(content.externalUrl, "_blank", "noopener,noreferrer");
      onClose();
    }
  }, [content, onClose]);

  if (!content || content.type === "link") return null;

  const meta = TYPE_META[content.type];
  const Icon = meta.icon;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <span className={cn("size-9 rounded-md flex items-center justify-center shrink-0", meta.tint)}>
            <Icon className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-1">
              {meta.label} · Optional pre-study
            </Badge>
            <DialogTitle className="text-lg truncate">{content.title}</DialogTitle>
          </div>
          {content.durationMinutes && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Clock className="size-3.5" /> {content.durationMinutes} min
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 shrink-0">
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Uploaded file (any type) — generate a signed URL and render
             appropriately. Falls back to legacy fields if no storage path. */}
          {content.storagePath ? (
            <StoredFileViewer content={content} moduleSlug={moduleSlug} />
          ) : (
            <>
              {content.type === "video" && content.videoUrl && (
                <div className="aspect-video bg-black">
                  <iframe
                    src={`${content.videoUrl}${content.videoUrl.includes("?") ? "&" : "?"}rel=0&modestbranding=1`}
                    className="w-full h-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={content.title}
                  />
                </div>
              )}

              {content.type === "document" && (
                <DocumentReader pages={content.documentPages ?? []} />
              )}

              {content.type === "slides" && (
                <SlideViewer slides={content.slides ?? []} />
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t text-xs text-muted-foreground bg-muted/40">
          Reviewing this is optional — you don&rsquo;t need to finish it before the seminar. The trainer will walk through the same material live.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders a content item that lives in Supabase Storage. Generates a
 * short-lived signed URL on open. PDFs/MP4s embed inline; binary formats
 * (Word, PowerPoint) fall back to a download button.
 */
function StoredFileViewer({ content, moduleSlug }: { content: LessonContent; moduleSlug?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!content.storagePath) return;
    signedUrlForContent(content.storagePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [content.storagePath]);

  if (error) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Could not load this file. {error}
      </div>
    );
  }
  if (!url) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Preparing preview…
      </div>
    );
  }

  const ext = (content.fileName ?? "").toLowerCase().split(".").pop() ?? "";
  const isPdf = ext === "pdf";
  const isMp4 = ext === "mp4" || ext === "webm" || ext === "mov";

  if (content.type === "video" && isMp4) {
    return <VideoPlayer url={url} contentId={content.id} moduleSlug={moduleSlug} />;
  }
  if (isPdf) {
    return (
      <iframe src={url} loading="lazy" className="w-full h-[70vh] bg-white" title={content.title} />
    );
  }
  // Word / PowerPoint / other — no inline preview; give a download link.
  return (
    <div className="p-12 text-center">
      <FileText className="size-12 mx-auto opacity-40 mb-3" />
      <div className="text-sm text-muted-foreground mb-4">
        {content.fileName ?? "Uploaded file"} — preview unavailable for this format.
      </div>
      <Button asChild>
        <a href={url} download={content.fileName ?? undefined} target="_blank" rel="noreferrer">
          <Download className="size-4 mr-1.5" /> Download to view
        </a>
      </Button>
    </div>
  );
}

/**
 * Native video player that records watch progress: resumes from the last
 * position, saves throttled (~10s) while playing, and on pause/end. Marks
 * the video complete at 90%+ server-side. No-ops in demo mode.
 */
function VideoPlayer({ url, contentId, moduleSlug }: { url: string; contentId: string; moduleSlug?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const lastSaved = React.useRef(0);
  const resumeRef = React.useRef(0);
  const metaReady = React.useRef(false);

  const trySeek = React.useCallback(() => {
    const v = ref.current;
    if (v && metaReady.current && resumeRef.current > 1 && resumeRef.current < (v.duration || Infinity) - 2) {
      v.currentTime = resumeRef.current;
      resumeRef.current = 0; // resume only once
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    getVideoProgress(contentId).then((p) => {
      if (cancelled || !p || p.completed) return;
      resumeRef.current = p.positionSec;
      trySeek();
    });
    return () => { cancelled = true; };
  }, [contentId, trySeek]);

  function persist() {
    const v = ref.current;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    lastSaved.current = Date.now();
    void saveVideoProgress({
      lessonContentId: contentId,
      moduleSlug: moduleSlug ?? null,
      positionSec: v.currentTime,
      durationSec: v.duration,
    });
  }

  return (
    <div className="aspect-video bg-black">
      <video
        ref={ref}
        src={url}
        controls
        className="w-full h-full"
        onLoadedMetadata={() => { metaReady.current = true; trySeek(); }}
        onTimeUpdate={() => { if (Date.now() - lastSaved.current > 10000) persist(); }}
        onPause={persist}
        onEnded={persist}
      />
    </div>
  );
}

function DocumentReader({ pages }: { pages: string[] }) {
  const [pageIdx, setPageIdx] = React.useState(0);
  const text = pages[pageIdx] ?? "";
  const lines = text.split("\n").filter(Boolean);
  return (
    <div>
      <div className="px-8 py-8 prose prose-sm max-w-none dark:prose-invert min-h-[400px]">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={i} className="text-2xl font-bold mb-4">{line.slice(2)}</h2>;
          return <p key={i} className="leading-relaxed mb-3 text-foreground/90">{line}</p>;
        })}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
          <Button variant="ghost" size="sm" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => Math.max(0, i - 1))}>
            ← Previous
          </Button>
          <div className="text-xs text-muted-foreground tabular-nums">Page {pageIdx + 1} of {pages.length}</div>
          <Button variant="ghost" size="sm" disabled={pageIdx === pages.length - 1} onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}

function SlideViewer({ slides }: { slides: { title: string; bullets: string[] }[] }) {
  const [idx, setIdx] = React.useState(0);
  const slide = slides[idx];
  if (!slide) return null;
  return (
    <div>
      <div className="aspect-[16/9] bg-gradient-to-br from-primary via-primary/85 to-primary/70 text-primary-foreground p-12 flex flex-col">
        <div className="text-2xl md:text-3xl font-bold tracking-tight mb-6">{slide.title}</div>
        <ul className="space-y-3 text-lg">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-[var(--gold)] mt-1">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          ← Previous slide
        </Button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "size-1.5 rounded-full transition-all",
                i === idx ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm" disabled={idx === slides.length - 1} onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}>
          Next slide →
        </Button>
      </div>
    </div>
  );
}
