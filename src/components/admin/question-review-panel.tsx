"use client";

// Reusable interactive question generation/review: a staged prep
// (reading → summarizing), then questions ONE AT A TIME with Add / Skip.
// "Add" saves & approves immediately; "Skip" discards. Used by the module page
// dialog AND the create-module wizard so the experience is identical.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StageProgress, type Stage } from "@/components/shared/stage-progress";
import { extractModuleSources, summarizeModule, generateQuestionDrafts, commitQuestionDraft } from "@/lib/server/ai-actions";

type Pool = "first-attempt" | "retake";
interface Draft { text: string; options: { text: string; correct: boolean }[]; explanation?: string }

const BATCH = 5;
const POOL_LABEL: Record<Pool, string> = { "first-attempt": "First attempt", retake: "Retake (easier)" };

export function QuestionReviewPanel({
  moduleSlug,
  onAddedChange,
}: {
  moduleSlug: string;
  onAddedChange?: (added: number) => void;
}) {
  const [phase, setPhase] = React.useState<"prep" | "review" | "error">("prep");
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pool, setPool] = React.useState<Pool>("first-attempt");
  const [buffer, setBuffer] = React.useState<Draft[]>([]);
  const [fetching, setFetching] = React.useState(false);
  const [added, setAdded] = React.useState(0);
  const [skipped, setSkipped] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [noMore, setNoMore] = React.useState(false);
  const seen = React.useRef<Record<Pool, string[]>>({ "first-attempt": [], retake: [] });
  const prepStarted = React.useRef(false);

  function patch(i: number, p: Partial<Stage>) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  React.useEffect(() => {
    if (prepStarted.current) return;
    prepStarted.current = true;
    void runPrep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPrep() {
    setPhase("prep"); setError(null);
    setStages([
      { label: "Reading your files", status: "active", detail: "Documents, slides, video…" },
      { label: "Summarizing the material", status: "pending" },
    ]);
    const ex = await extractModuleSources(moduleSlug);
    if (!ex.ok) { setError(ex.error); setPhase("error"); return; }
    patch(0, { status: "done", detail: `${ex.items.length} item(s) · ${ex.totalChars.toLocaleString()} characters` });
    const notes = ex.items.filter((i) => i.note).map((i) => i.note!) as string[];
    if (ex.totalChars < 200) { setError("No readable content found in your files. Upload a real document or short video."); setPhase("error"); return; }
    patch(1, { status: "active", detail: "Condensing into a study guide…" });
    await summarizeModule(moduleSlug);
    patch(1, { status: "done" });
    if (notes.length) toast.message("Some files couldn't be read", { description: notes.join(" ") });
    await fetchBatch(true);
    setPhase("review");
  }

  async function fetchBatch(initial = false) {
    setFetching(true);
    const res = await generateQuestionDrafts(moduleSlug, pool, BATCH, seen.current[pool]);
    setFetching(false);
    if (!res.ok) { if (initial) { setError(res.error ?? "Generation failed"); setPhase("error"); } else toast.error(res.error ?? "Could not draft more"); return; }
    const fresh = (res.drafts ?? []).filter((d) => !seen.current[pool].includes(d.text));
    if (fresh.length === 0) setNoMore(true);
    else setBuffer((prev) => [...prev, ...fresh]);
  }

  React.useEffect(() => {
    if (phase === "review" && buffer.length <= 1 && !fetching && !noMore) void fetchBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, phase, pool]);

  const current = buffer[0];

  function markSeen(text: string) {
    seen.current[pool] = [...seen.current[pool], text].slice(-50);
  }

  async function handleAdd() {
    if (!current) return;
    setBusy(true);
    const res = await commitQuestionDraft(moduleSlug, pool, current);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not add"); return; }
    markSeen(current.text);
    const next = added + 1;
    setAdded(next);
    onAddedChange?.(next);
    setBuffer((prev) => prev.slice(1));
  }

  function handleSkip() {
    if (!current) return;
    markSeen(current.text);
    setSkipped((s) => s + 1);
    setBuffer((prev) => prev.slice(1));
  }

  function switchPool(p: Pool) {
    if (p === pool) return;
    setPool(p);
    setBuffer([]);
    setNoMore(false);
  }

  if (phase === "prep") {
    return <div className="rounded-lg border bg-card p-5"><StageProgress stages={stages} /></div>;
  }

  if (phase === "error") {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
        <AlertCircle className="size-4 shrink-0 mt-0.5" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{added} added</span>
          <span className="text-muted-foreground"> · {skipped} skipped</span>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5">
          {(["first-attempt", "retake"] as Pool[]).map((p) => (
            <button key={p} onClick={() => switchPool(p)}
              className={cn("text-xs px-2.5 py-1 rounded transition-colors", pool === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
              {POOL_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[240px] flex items-stretch">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={`${pool}-${added}-${skipped}`}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }} className="w-full rounded-lg border bg-card p-4 space-y-3">
              <div className="font-medium">{current.text}</div>
              <ul className="space-y-1.5">
                {current.options.map((o, i) => (
                  <li key={i} className={cn("flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5",
                    o.correct ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border")}>
                    {o.correct ? <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <span className="size-3.5 shrink-0" />}
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
              {current.explanation && <p className="text-xs text-muted-foreground border-t pt-2">{current.explanation}</p>}
            </motion.div>
          ) : (
            <div className="w-full rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              {noMore ? "No more new questions for this pool — try the other pool or finish." : (<><Loader2 className="size-5 animate-spin text-primary" /> Drafting questions…</>)}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleSkip} disabled={!current || busy} className="flex-1">
          <X className="size-4 mr-1.5" /> Skip
        </Button>
        <Button onClick={handleAdd} disabled={!current || busy} className="flex-1">
          {busy ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />} Add question
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        <strong>Add</strong> saves &amp; approves the question · <strong>Skip</strong> discards it (nothing saved).
        {fetching && current && <> · <Loader2 className="size-3 animate-spin inline" /> drafting more…</>}
      </p>
    </div>
  );
}
