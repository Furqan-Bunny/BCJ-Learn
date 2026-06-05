"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlayCircle, FileText, Layers, Link2, Clock, Download, X, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonContent, ContentType } from "@/types";
import { signedUrlForContent } from "@/lib/supabase/storage";
import { saveVideoProgress, getVideoProgress } from "@/lib/server/progress-actions";
import { useT } from "@/lib/i18n/provider";

const TYPE_META: Record<ContentType, { icon: React.ComponentType<{ className?: string }>; label: string; tint: string }> = {
  video:    { icon: PlayCircle, label: "Video",    tint: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40" },
  document: { icon: FileText,   label: "Document", tint: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40" },
  slides:   { icon: Layers,     label: "Slides",   tint: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40" },
  link:     { icon: Link2,      label: "Link",     tint: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40" },
};

const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "ogg"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const OFFICE_EXTS = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"];

function extOf(content: LessonContent): string {
  return (content.fileName ?? content.storagePath ?? "").toLowerCase().split(".").pop() ?? "";
}

interface ContentViewerProps {
  content: LessonContent | null;
  onClose: () => void;
  moduleSlug?: string;
}

/** Read-only viewer used by managers for OPTIONAL pre-study (per scope §5.1.3). */
export function ContentViewer({ content, onClose, moduleSlug }: ContentViewerProps) {
  const t = useT();
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // External links open in a new tab — no need for a modal.
  React.useEffect(() => {
    if (content && content.type === "link" && content.externalUrl) {
      window.open(content.externalUrl, "_blank", "noopener,noreferrer");
      onClose();
    }
  }, [content, onClose]);

  // Generate a short-lived signed URL for any stored file.
  React.useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    const path = content?.storagePath;
    if (!path) return;
    signedUrlForContent(path)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [content?.storagePath]);

  if (!content || content.type === "link") return null;

  const meta = TYPE_META[content.type];
  const Icon = meta.icon;
  const ext = extOf(content);
  const isOffice = OFFICE_EXTS.includes(ext);
  const fileName = content.fileName ?? content.storagePath?.split("/").pop() ?? undefined;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-6xl w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center gap-3 bg-card">
          <span className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", meta.tint)}>
            <Icon className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-0.5">
              {t(("type." + content.type) as Parameters<typeof t>[0])} · {t("content.optionalPreStudy")}
            </Badge>
            <DialogTitle className="text-base md:text-lg truncate leading-tight">{content.title}</DialogTitle>
          </div>
          {content.durationMinutes && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Clock className="size-3.5" /> {content.durationMinutes} {t("common.minutes")}
            </div>
          )}
          {/* Stored-file actions */}
          {url && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                <a href={url} download={fileName} target="_blank" rel="noreferrer">
                  <Download className="size-3.5" /> {t("common.download")}
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" /> {t("content.openTab")}
                </a>
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 shrink-0">
            <X className="size-4" />
          </Button>
        </div>

        {/* Body — fills the modal; each preview type stretches to full height. */}
        <div className="flex-1 min-h-0 bg-neutral-100 dark:bg-neutral-900/50">
          {content.storagePath ? (
            error ? (
              <Centered>
                <div className="text-sm text-muted-foreground">{t("content.loadError", { error })}</div>
              </Centered>
            ) : !url ? (
              <Centered>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> {t("content.preparing")}
                </div>
              </Centered>
            ) : (
              <StoredFilePreview content={content} url={url} ext={ext} moduleSlug={moduleSlug} fileName={fileName} />
            )
          ) : (
            <div className="h-full overflow-y-auto">
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
              {content.type === "document" && <DocumentReader pages={content.documentPages ?? []} />}
              {content.type === "slides" && <SlideViewer slides={content.slides ?? []} />}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t text-xs text-muted-foreground bg-card flex items-center gap-2">
          <span className="truncate">{t("content.optionalDisclaimer")}</span>
          {isOffice && url && (
            <span className="ml-auto shrink-0 hidden md:inline opacity-70">{t("content.renderingExternally")}</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center p-12 text-center">{children}</div>;
}

/**
 * Universal preview for a file in Supabase Storage. Native inline for
 * PDF / video / images; Office formats (Word, PowerPoint, Excel) render through
 * Microsoft's online viewer; anything else offers a download.
 */
function StoredFilePreview({
  content,
  url,
  ext,
  moduleSlug,
  fileName,
}: {
  content: LessonContent;
  url: string;
  ext: string;
  moduleSlug?: string;
  fileName?: string;
}) {
  const t = useT();

  if (VIDEO_EXTS.includes(ext)) {
    return <VideoPlayer url={url} contentId={content.id} moduleSlug={moduleSlug} />;
  }
  if (ext === "pdf") {
    return <iframe src={url} loading="lazy" className="w-full h-full border-0 bg-white" title={content.title} />;
  }
  if (IMAGE_EXTS.includes(ext)) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={content.title} className="max-w-full max-h-full object-contain rounded-md shadow-sm" />
      </div>
    );
  }
  if (OFFICE_EXTS.includes(ext)) {
    const office = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe src={office} loading="lazy" className="w-full h-full border-0 bg-white" title={content.title} />;
  }
  // Unknown binary — offer a download.
  return (
    <Centered>
      <div>
        <FileText className="size-12 mx-auto opacity-40 mb-3" />
        <div className="text-sm text-muted-foreground mb-4">
          {t("content.previewUnavailable", { name: fileName ?? t("content.uploadedFile") })}
        </div>
        <Button asChild>
          <a href={url} download={fileName} target="_blank" rel="noreferrer">
            <Download className="size-4 mr-1.5" /> {t("common.download")}
          </a>
        </Button>
      </div>
    </Centered>
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
    <div className="h-full bg-black flex items-center justify-center">
      <video
        ref={ref}
        src={url}
        controls
        className="max-w-full max-h-full"
        onLoadedMetadata={() => { metaReady.current = true; trySeek(); }}
        onTimeUpdate={() => { if (Date.now() - lastSaved.current > 10000) persist(); }}
        onPause={persist}
        onEnded={persist}
      />
    </div>
  );
}

function DocumentReader({ pages }: { pages: string[] }) {
  const t = useT();
  const [pageIdx, setPageIdx] = React.useState(0);
  const text = pages[pageIdx] ?? "";
  const lines = text.split("\n").filter(Boolean);
  return (
    <div>
      <div className="px-8 py-8 help-doc max-w-none min-h-[400px] bg-card mx-auto max-w-3xl my-6 rounded-lg border shadow-sm">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={i} className="text-2xl font-bold mb-4">{line.slice(2)}</h2>;
          return <p key={i} className="leading-relaxed mb-3 text-foreground/90">{line}</p>;
        })}
      </div>
      {pages.length > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t bg-card">
          <Button variant="ghost" size="sm" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => Math.max(0, i - 1))}>
            {t("content.prevPage")}
          </Button>
          <div className="text-xs text-muted-foreground tabular-nums">{t("content.pageOf", { i: pageIdx + 1, n: pages.length })}</div>
          <Button variant="ghost" size="sm" disabled={pageIdx === pages.length - 1} onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}>
            {t("content.nextPage")}
          </Button>
        </div>
      )}
    </div>
  );
}

function SlideViewer({ slides }: { slides: { title: string; bullets: string[] }[] }) {
  const t = useT();
  const [idx, setIdx] = React.useState(0);
  const slide = slides[idx];
  if (!slide) return null;
  return (
    <div className="p-6">
      <div className="aspect-[16/9] bg-gradient-to-br from-primary via-primary/85 to-primary/70 text-primary-foreground p-12 flex flex-col overflow-hidden rounded-xl shadow-lg max-w-4xl mx-auto">
        <div className="text-2xl md:text-3xl font-bold tracking-tight mb-6 shrink-0">{slide.title}</div>
        <ul className="space-y-3 text-lg overflow-y-auto pr-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-[var(--gold)] mt-1">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          {t("content.prevSlide")}
        </Button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-muted-foreground tabular-nums">{t("content.slideOf", { i: idx + 1, n: slides.length })}</span>
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
        </div>
        <Button variant="ghost" size="sm" disabled={idx === slides.length - 1} onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}>
          {t("content.nextSlide")}
        </Button>
      </div>
    </div>
  );
}
