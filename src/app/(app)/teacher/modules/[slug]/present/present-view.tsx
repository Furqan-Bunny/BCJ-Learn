"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Play, Pause, FileText, PlayCircle, Layers, Link2, Clock,
  Maximize2, Minimize2, GraduationCap, Download, Loader2,
} from "lucide-react";
import type { ContentType, LessonContent, ModuleDef } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { startSession as startSessionAction, endSession as endSessionAction } from "@/lib/server/module-actions";
import { recordContentView } from "@/lib/server/content-views";
import { signedUrlForContent } from "@/lib/supabase/storage";
import { CheckinLobby } from "./checkin-lobby";

// Presentation shows the lead's ACTUAL uploaded file (no AI extraction) whenever
// one exists. Native inline for video/PDF/images; Office formats via Microsoft's
// online viewer; anything else offers a download.
const RAW_VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "ogg"];
const RAW_IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const RAW_OFFICE_EXTS = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"];

const TYPE_META: Record<ContentType, { icon: React.ComponentType<{ className?: string }>; label: string; tint: string }> = {
  video:    { icon: PlayCircle, label: "Video",    tint: "text-rose-400 bg-rose-500/15" },
  document: { icon: FileText,   label: "Document", tint: "text-sky-400 bg-sky-500/15" },
  slides:   { icon: Layers,     label: "Slides",   tint: "text-amber-400 bg-amber-500/15" },
  link:     { icon: Link2,      label: "Link",     tint: "text-violet-400 bg-violet-500/15" },
};

export function PresenterView({
  mod,
  startInPresentation = false,
  initialViewedContentIds = [],
}: {
  mod: ModuleDef;
  startInPresentation?: boolean;
  initialViewedContentIds?: string[];
}) {
  const slug = mod.slug;
  const router = useRouter();

  // Phase 1 = check-in lobby, Phase 2 = presentation. Start in the lobby unless
  // the session was already begun.
  const [phase, setPhase] = React.useState<"lobby" | "presenting">(startInPresentation ? "presenting" : "lobby");

  // Content items the user has already viewed in this delivery. Hydrated from
  // `content_views` on mount so completion persists across reloads / Back.
  const [viewed, setViewed] = React.useState<Set<string>>(() => new Set(initialViewedContentIds));

  function markViewed(contentId: string) {
    setViewed((prev) => {
      if (prev.has(contentId)) return prev;
      const next = new Set(prev);
      next.add(contentId);
      return next;
    });
    // Persist in the background — failure is non-fatal (the local set still
    // reflects current state; next reload will retry from server).
    void recordContentView(slug, contentId);
  }

  // Items flagged "don't show on presentation day" are dropped from the live
  // presenter view (they stay available to employees as optional pre-study).
  const presentLessons = React.useMemo(
    () => mod.lessons.map((l) => ({ ...l, contents: l.contents.filter((c) => !c.presentationHidden) })),
    [mod],
  );

  const playlist = React.useMemo(() => {
    return presentLessons.flatMap((l) =>
      l.contents.map((c) => ({ lesson: l, content: c })),
    );
  }, [presentLessons]);

  const [idx, setIdx] = React.useState(0);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onChange() {
      setIsFullscreen(typeof document !== "undefined" && !!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function enterFullscreen() {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) return;
    try {
      await (stageRef.current ?? document.documentElement).requestFullscreen();
    } catch {
      // Browser rejected; toggle still works on direct user gesture.
    }
  }

  async function exitFullscreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }

  function toggleFullscreen() {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }

  async function startPresentation() {
    setPhase("presenting");
    setRunning(true);
    void enterFullscreen();
    const res = await startSessionAction(slug);
    if (!res.ok) toast.error(res.error ?? "Could not start session");
  }

  const current = playlist[idx];
  const totalMinutes = mod.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); }
      else if (e.key === "Escape" && navOpen) { setNavOpen(false); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [idx, navOpen, isFullscreen]); // eslint-disable-line

  function next() {
    // Leaving the current item — mark it viewed before advancing.
    const leaving = playlist[idx]?.content?.id;
    if (leaving) markViewed(leaving);
    setIdx((i) => Math.min(playlist.length - 1, i + 1));
    setRunning(true);
  }
  function prev() {
    setIdx((i) => Math.max(0, i - 1));
    setRunning(true);
  }
  function jumpTo(i: number) {
    // Record the item we're leaving so it stays checked off.
    const leaving = playlist[idx]?.content?.id;
    if (leaving && i !== idx) markViewed(leaving);
    setIdx(i);
    setNavOpen(false);
    setRunning(true);
  }

  async function endSession() {
    void exitFullscreen();
    const res = await endSessionAction(slug);
    if (!res.ok) {
      toast.error(res.error ?? "Could not end session");
      return;
    }
    toast.success("Session ended — quiz is now open to the room", {
      description: "Managers who checked in can start the Module quiz on their devices now.",
    });
    setTimeout(() => router.push(`/teacher/modules/${slug}/results`), 1200);
  }

  const lessonsWithCounts = presentLessons.map((l) => l.contents.length);
  let runningCount = 0;
  let currentLessonIndex = 0;
  let positionInLesson = 0;
  for (let i = 0; i < lessonsWithCounts.length; i++) {
    if (idx < runningCount + lessonsWithCounts[i]) {
      currentLessonIndex = i;
      positionInLesson = idx - runningCount;
      break;
    }
    runningCount += lessonsWithCounts[i];
  }
  const currentLesson = presentLessons[currentLessonIndex];

  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedSecRem = elapsedSec % 60;

  // Phase 1 — check-in lobby. Starting the presentation advances to phase 2.
  if (phase === "lobby") {
    return <CheckinLobby mod={mod} onStart={startPresentation} />;
  }

  return (
    <div ref={stageRef} className="fixed inset-0 z-50 bg-slate-950 text-slate-50 flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-white/10 backdrop-blur bg-slate-950/80">
        <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
          <Link href={`/teacher/modules/${slug}`}>
            <ArrowLeft className="size-4 mr-1" /> Exit
          </Link>
        </Button>
        <div className="ml-2 flex items-center gap-2">
          <Badge className="bg-[var(--gold)] text-slate-900 border-transparent uppercase tracking-wider text-[10px]">
            Presenter
          </Badge>
          <span className="text-sm font-medium">{mod.title}</span>
          <span className="text-xs text-slate-400">— Module {mod.number}</span>
        </div>

        <div className="flex-1 mx-6 max-w-2xl">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>
              Lesson <span className="text-white font-mono">{currentLessonIndex + 1}</span> of {presentLessons.length} — <span className="text-white">{currentLesson?.title}</span>
            </span>
            <span className="font-mono tabular-nums">
              {elapsedMin}:{elapsedSecRem.toString().padStart(2, "0")} elapsed · {totalMinutes} min planned
            </span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden flex">
            {presentLessons.map((l, li) => {
              const isCurrent = li === currentLessonIndex;
              const isPast = li < currentLessonIndex;
              const segments = l.contents.length;
              const fillPct = isPast ? 100 : isCurrent ? ((positionInLesson + 1) / Math.max(segments, 1)) * 100 : 0;
              const widthPct = (segments / playlist.length) * 100;
              return (
                <div
                  key={l.id}
                  className="h-full relative border-r border-slate-950 last:border-r-0"
                  style={{ width: `${widthPct}%` }}
                >
                  <div
                    className={cn(
                      "h-full transition-all",
                      isCurrent ? "bg-[var(--gold)]" : isPast ? "bg-emerald-500" : "bg-transparent",
                    )}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRunning((r) => !r)}
          className="text-slate-300 hover:text-white hover:bg-white/10"
        >
          {running ? <Pause className="size-4 mr-1.5" /> : <Play className="size-4 mr-1.5" />}
          {running ? "Pause" : "Resume"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="text-slate-300 hover:text-white hover:bg-white/10 size-9"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen (F)"}
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNavOpen((o) => !o)}
          className="text-slate-300 hover:text-white hover:bg-white/10"
        >
          <Layers className="size-4 mr-1.5" /> Outline
        </Button>
      </header>

      <div className={cn(
        "flex-1 grid min-h-0 transition-[grid-template-columns] duration-300 ease-out",
        navOpen ? "grid-cols-[280px_1fr]" : "grid-cols-[0px_1fr]",
      )}>
        <aside className={cn(
          "border-r border-white/10 overflow-y-auto bg-slate-950/50 transition-opacity duration-200",
          !navOpen && "opacity-0 pointer-events-none",
        )}>
          {presentLessons.map((lesson, li) => {
            const isCurrentLesson = li === currentLessonIndex;
            return (
              <div key={lesson.id} className={cn("border-b border-white/10", isCurrentLesson && "bg-white/5")}>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>L{lesson.order}</span>
                    <Clock className="size-3" />
                    <span>{lesson.durationMinutes} min</span>
                  </div>
                  <div className={cn("text-sm font-medium mt-0.5", isCurrentLesson ? "text-white" : "text-slate-300")}>
                    {lesson.title}
                  </div>
                </div>
                <ul>
                  {lesson.contents.map((c, ci) => {
                    let absoluteIdx = 0;
                    for (let k = 0; k < li; k++) absoluteIdx += presentLessons[k].contents.length;
                    absoluteIdx += ci;
                    const isCurrent = absoluteIdx === idx;
                    // Strike-through only when the item has actually been viewed
                    // (persisted via content_views). Going Back no longer "uncrosses" it.
                    const isViewed = viewed.has(c.id) && !isCurrent;
                    const meta = TYPE_META[c.type];
                    const Icon = meta.icon;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => jumpTo(absoluteIdx)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors",
                            "hover:bg-white/10",
                            isCurrent && "bg-[var(--gold)]/15 border-l-2 border-[var(--gold)] -ml-px",
                          )}
                        >
                          <span className={cn("size-6 rounded flex items-center justify-center shrink-0", meta.tint)}>
                            <Icon className="size-3" />
                          </span>
                          <span className={cn("flex-1 min-w-0 text-xs truncate", isCurrent ? "text-white font-medium" : isViewed ? "text-slate-500 line-through" : "text-slate-300")}>
                            {c.title}
                          </span>
                          {c.durationMinutes && (
                            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{c.durationMinutes}m</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </aside>

        <main className="overflow-y-auto p-8 flex flex-col">
          {current && (
            <ContentStage
              content={current.content}
              lessonTitle={current.lesson.title}
              onVideoEnd={next}
              autoplay={running}
            />
          )}

          <div className="mt-auto pt-6 flex items-center justify-between gap-4 sticky bottom-0 -mx-8 px-8 py-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
            <Button
              variant="outline"
              onClick={prev}
              disabled={idx === 0}
              className="bg-slate-900 border-white/20 text-white hover:bg-white/10 disabled:opacity-40"
            >
              <ArrowLeft className="size-4 mr-1.5" /> Previous
            </Button>
            <div className="text-xs text-slate-400 tabular-nums">
              Item {idx + 1} of {playlist.length}
            </div>
            {idx === playlist.length - 1 ? (
              <Button
                onClick={endSession}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <GraduationCap className="size-4 mr-1.5" /> End session — open quiz
              </Button>
            ) : (
              <Button
                onClick={next}
                className="bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-slate-900"
              >
                Next <ArrowRight className="size-4 ml-1.5" />
              </Button>
            )}
          </div>
        </main>
      </div>

      <div className="absolute bottom-4 right-6 text-[10px] text-slate-500 flex items-center gap-3">
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">→</kbd> navigate</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">space</kbd> play/pause</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20">F</kbd> fullscreen</span>
      </div>
    </div>
  );
}

function ContentStage({
  content,
  lessonTitle,
  onVideoEnd,
  autoplay,
}: {
  content: LessonContent;
  lessonTitle: string;
  onVideoEnd: () => void;
  autoplay: boolean;
}) {
  const meta = TYPE_META[content.type];
  const Icon = meta.icon;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("size-7 rounded flex items-center justify-center", meta.tint)}>
          <Icon className="size-4" />
        </span>
        <Badge className="bg-white/10 border-white/20 text-slate-300 uppercase tracking-wider text-[10px]">
          {meta.label}
        </Badge>
        <span className="text-xs text-slate-500">· in {lessonTitle}</span>
      </div>

      <h2 className="text-3xl font-bold tracking-tight mb-1">{content.title}</h2>
      {content.durationMinutes && (
        <div className="text-sm text-slate-400 flex items-center gap-1.5 mb-6">
          <Clock className="size-3.5" /> {content.durationMinutes} min
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
        {/* The lead's actual uploaded file takes priority — shown exactly as-is. */}
        {content.storagePath ? (
          <StoredFilePresenter content={content} autoplay={autoplay} onVideoEnd={onVideoEnd} />
        ) : (
          <>
        {content.type === "video" && content.videoUrl && (
          /youtube\.com|youtu\.be|vimeo\.com/i.test(content.videoUrl) ? (
            <YouTubePresenter
              url={content.videoUrl}
              title={content.title}
              autoplay={autoplay}
              onEnded={onVideoEnd}
            />
          ) : (
            <video
              key={content.videoUrl}
              src={content.videoUrl}
              controls
              autoPlay={autoplay}
              onEnded={onVideoEnd}
              className="w-full aspect-video bg-black"
            />
          )
        )}

        {content.type === "document" && (
          <DocumentReader pages={content.documentPages ?? []} />
        )}

        {content.type === "slides" && (
          <SlidePlayer slides={content.slides ?? []} />
        )}

        {content.type === "link" && (
          <div className="p-12 text-center">
            <Link2 className="size-12 mx-auto text-violet-400 mb-4" />
            <div className="text-lg font-medium mb-2">External resource</div>
            <a
              href={content.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 hover:underline break-all"
            >
              {content.externalUrl}
            </a>
            <div className="mt-6">
              <Button asChild className="bg-violet-500 hover:bg-violet-600">
                <a href={content.externalUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </Button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {content.fileName && (
        <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
          <span>{content.fileName}</span>
          {content.fileSize && (
            <>
              <span>·</span>
              <span>{content.fileSize}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Presents the lead's ACTUAL uploaded file — exactly as uploaded, no AI
 * extraction. Native inline for video/PDF/images; Office formats (Word /
 * PowerPoint / Excel) through Microsoft's online viewer; else a download.
 */
function StoredFilePresenter({
  content,
  autoplay,
  onVideoEnd,
}: {
  content: LessonContent;
  autoplay: boolean;
  onVideoEnd: () => void;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    const path = content.storagePath;
    if (!path) return;
    signedUrlForContent(path)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [content.storagePath]);

  if (error) {
    return <div className="p-12 text-center text-sm text-slate-400">Couldn&apos;t load this file. {error}</div>;
  }
  if (!url) {
    return (
      <div className="p-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Preparing…
      </div>
    );
  }

  const ext = (content.fileName ?? content.storagePath ?? "").toLowerCase().split(".").pop() ?? "";

  if (RAW_VIDEO_EXTS.includes(ext)) {
    return (
      <video
        key={url}
        src={url}
        controls
        autoPlay={autoplay}
        onEnded={onVideoEnd}
        className="w-full aspect-video bg-black"
      />
    );
  }
  if (ext === "pdf") {
    return <iframe src={url} loading="lazy" className="w-full h-[72vh] border-0 bg-white" title={content.title} />;
  }
  if (RAW_IMAGE_EXTS.includes(ext)) {
    return (
      <div className="bg-slate-950 flex items-center justify-center p-4 max-h-[72vh] overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={content.title} className="max-w-full max-h-[68vh] object-contain" />
      </div>
    );
  }
  if (RAW_OFFICE_EXTS.includes(ext)) {
    const office = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe src={office} loading="lazy" className="w-full h-[72vh] border-0 bg-white" title={content.title} />;
  }
  return (
    <div className="p-12 text-center">
      <FileText className="size-12 mx-auto text-slate-500 mb-3" />
      <div className="text-sm text-slate-300 mb-4">{content.fileName ?? "Uploaded file"}</div>
      <Button asChild>
        <a href={url} download={content.fileName ?? undefined} target="_blank" rel="noreferrer">
          <Download className="size-4 mr-1.5" /> Download
        </a>
      </Button>
    </div>
  );
}

function YouTubePresenter({
  url,
  title,
  autoplay,
  onEnded,
}: {
  url: string;
  title: string;
  autoplay: boolean;
  onEnded: () => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const onEndedRef = React.useRef(onEnded);
  React.useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const src = React.useMemo(() => {
    let embed = url;
    if (embed.includes("youtube.com/watch")) {
      const u = new URL(embed);
      const videoId = u.searchParams.get("v");
      if (videoId) embed = `https://www.youtube.com/embed/${videoId}`;
    } else if (embed.includes("youtu.be/")) {
      const id = embed.split("youtu.be/")[1].split(/[?&]/)[0];
      embed = `https://www.youtube.com/embed/${id}`;
    }
    const u = new URL(embed);
    u.searchParams.set("autoplay", autoplay ? "1" : "0");
    u.searchParams.set("enablejsapi", "1");
    u.searchParams.set("rel", "0");
    u.searchParams.set("modestbranding", "1");
    u.searchParams.set("playsinline", "1");
    if (typeof window !== "undefined") u.searchParams.set("origin", window.location.origin);
    return u.toString();
  }, [url, autoplay]);

  React.useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (typeof e.origin !== "string") return;
      if (!e.origin.includes("youtube.com") && !e.origin.includes("youtube-nocookie.com")) return;

      let data: unknown = e.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== "object") return;
      const obj = data as Record<string, unknown>;
      if (obj.event === "onStateChange" && obj.info === 0) {
        onEndedRef.current();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleLoad() {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const listeningMsg = JSON.stringify({ event: "listening", id: 1, channel: "widget" });
    iframe.contentWindow.postMessage(listeningMsg, "*");

    const subscribeMsg = JSON.stringify({
      event: "command",
      func: "addEventListener",
      args: ["onStateChange"],
      id: 1,
      channel: "widget",
    });
    iframe.contentWindow.postMessage(subscribeMsg, "*");
  }

  return (
    <div className="aspect-video bg-black">
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        title={title}
        onLoad={handleLoad}
      />
    </div>
  );
}

function DocumentReader({ pages }: { pages: string[] }) {
  const [pageIdx, setPageIdx] = React.useState(0);
  const text = pages[pageIdx] ?? "";
  const lines = text.split("\n").filter(Boolean);

  return (
    <div className="bg-slate-900 text-slate-100">
      <div className="p-8 md:p-12 min-h-[400px] max-h-[60vh] overflow-y-auto">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) return <h3 key={i} className="text-xl font-bold mt-6 mb-3 text-white">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={i} className="text-2xl font-bold mb-4 text-white">{line.slice(2)}</h2>;
          return <p key={i} className="leading-relaxed mb-3 text-slate-300">{line}</p>;
        })}
      </div>
      <div className="flex items-center justify-between p-3 border-t border-white/10 bg-slate-950/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
          disabled={pageIdx === 0}
          className="text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          ← Previous page
        </Button>
        <div className="text-xs text-slate-400 tabular-nums">
          Page {pageIdx + 1} of {pages.length}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
          disabled={pageIdx === pages.length - 1}
          className="text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          Next page →
        </Button>
      </div>
    </div>
  );
}

function SlidePlayer({ slides }: { slides: { title: string; bullets: string[] }[] }) {
  const [slideIdx, setSlideIdx] = React.useState(0);
  const slide = slides[slideIdx];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
      <div className="aspect-[16/9] p-12 md:p-16 flex flex-col overflow-hidden">
        {slide ? (
          <>
            <div className="text-3xl md:text-4xl font-bold tracking-tight mb-8 shrink-0">{slide.title}</div>
            <ul className="space-y-3 text-xl text-slate-200 overflow-y-auto pr-2">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[var(--gold)] mt-1">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="m-auto text-slate-500">No slides</div>
        )}
      </div>
      <div className="flex items-center justify-between p-3 border-t border-white/10 bg-slate-950/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
          disabled={slideIdx === 0}
          className="text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          ← Previous slide
        </Button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-slate-400 tabular-nums">Slide {slideIdx + 1} of {slides.length}</span>
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIdx(i)}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  i === slideIdx ? "bg-[var(--gold)] w-6" : "bg-white/30 hover:bg-white/50",
                )}
              />
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={slideIdx === slides.length - 1}
          className="text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          Next slide →
        </Button>
      </div>
    </div>
  );
}
