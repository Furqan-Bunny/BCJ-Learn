"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Check, X, RefreshCw, Edit3, Sparkles, Search, Filter, CheckCircle2, AlertCircle, Loader2, History, RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { fmtRelative } from "@/lib/format";
import type { ModuleDef, Question, QuestionPool, QuestionStatus } from "@/types";
import type { QuestionVersion } from "@/lib/db/questions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  generateQuestions,
  approveQuestion,
  rejectQuestion,
  regenerateQuestion,
  editQuestion,
  getQuestionVersions,
  restoreQuestionVersion,
} from "@/lib/server/ai-actions";
import { publishModule } from "@/lib/server/module-actions";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface TeacherQuestionsViewProps {
  mod: ModuleDef;
  initialQuestions: Question[];
}

export function TeacherQuestionsView({ mod, initialQuestions }: TeacherQuestionsViewProps) {
  const router = useRouter();
  // Hold local state for instant UI feedback; refresh after server actions.
  const [questions, setQuestions] = React.useState<Question[]>(initialQuestions);
  const [pool, setPool] = React.useState<QuestionPool | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<QuestionStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(initialQuestions[0]?.id ?? null);
  const [generating, setGenerating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // Keep local state in sync if server data refreshes.
  React.useEffect(() => {
    setQuestions(initialQuestions);
    if (!selected && initialQuestions[0]) setSelected(initialQuestions[0].id);
  }, [initialQuestions]); // eslint-disable-line

  const filtered = questions.filter((q) => {
    if (pool !== "all" && q.pool !== pool) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const current = questions.find((q) => q.id === selected) ?? filtered[0];

  function patchLocal(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    patchLocal(id, { status: "approved", approvedAt: new Date().toISOString() });
    const res = await approveQuestion(id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Failed to approve");
      router.refresh();
      return;
    }
    toast.success("Question approved");
  }

  async function handleReject(id: string) {
    setBusyId(id);
    patchLocal(id, { status: "rejected" });
    const res = await rejectQuestion(id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Failed to reject");
      router.refresh();
      return;
    }
    toast("Question rejected");
  }

  async function handleRegenerate(id: string) {
    const toastId = `regen-${id}`;
    toast.loading("AI re-drafting…", { id: toastId });
    setBusyId(id);
    const res = await regenerateQuestion(id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Failed to regenerate", { id: toastId });
      return;
    }
    toast.success("AI generated a new draft", { id: toastId });
    router.refresh();
  }

  async function handleGenerate() {
    if (DEMO_MODE) {
      toast.success("Demo mode: stubbing 80 pending questions (no API call)");
      return;
    }
    setGenerating(true);
    const toastId = "generate-batch";
    toast.loading("OpenAI is drafting 80 questions… (≈ 30 sec)", { id: toastId });
    const res = await generateQuestions(mod.slug);
    setGenerating(false);
    if (!res.ok) {
      toast.error(res.error ?? "Generation failed", { id: toastId });
      return;
    }
    toast.success(`Drafted ${res.created} new questions`, { id: toastId });
    router.refresh();
  }

  const counts = {
    all: questions.length,
    pending: questions.filter((q) => q.status === "pending").length,
    approved: questions.filter((q) => q.status === "approved").length,
    rejected: questions.filter((q) => q.status === "rejected").length,
    edited: questions.filter((q) => q.status === "edited").length,
  };

  const approvedTotal = counts.approved + counts.edited;
  const approvedPct = counts.all ? Math.round((approvedTotal / counts.all) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow={`Module ${mod.number} — Question review`}
        title={mod.title}
        description="Review every AI-drafted question. Approve, edit, regenerate, or reject. Only approved questions go live."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-[var(--ai)]" />}
              {generating ? "Drafting…" : "Generate questions with AI"}
            </Button>
            <Button
              onClick={async () => {
                const res = await publishModule(mod.slug);
                if (!res.ok) { toast.error(res.error ?? "Could not publish"); return; }
                toast.success(`Module ${mod.number} published`);
                router.refresh();
              }}
            >
              Publish ({approvedTotal}/{counts.all})
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-[var(--ai)]" />
              <span className="font-medium">AI-drafted question bank</span>
              <Badge variant="outline" className="ml-1 text-[10px]">{counts.all} total</Badge>
            </div>
            <div className="text-sm font-mono tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{approvedTotal}</span> approved
              <span className="text-muted-foreground"> · {approvedPct}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${approvedPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <PoolBadge label="Pending" count={counts.pending} tone="amber" />
            <PoolBadge label="Approved" count={counts.approved} tone="emerald" />
            <PoolBadge label="Edited" count={counts.edited} tone="violet" />
            <PoolBadge label="Rejected" count={counts.rejected} tone="rose" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={pool} onValueChange={(v) => setPool(v as QuestionPool | "all")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="first-attempt">First attempt</TabsTrigger>
            <TabsTrigger value="retake">Retake (easier)</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuestionStatus | "all")}>
          <TabsList>
            <TabsTrigger value="all">Any status</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-xs text-muted-foreground ml-auto">
          <Filter className="size-3 inline mr-1" />
          {filtered.length} of {questions.length}
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Question queue
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="size-6 mx-auto mb-2 opacity-50" />
                {questions.length === 0
                  ? "No questions yet. Click \"Generate questions with AI\" to draft 80."
                  : "No questions match your filters."}
              </div>
            )}
            {filtered.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setSelected(q.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-start gap-3",
                  current?.id === q.id && "bg-primary/5",
                )}
              >
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 mt-0.5">
                  Q{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm line-clamp-2 leading-snug font-medium">{q.text}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <StatusBadge variant={q.status} />
                    <StatusBadge variant={q.pool} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-6 md:p-8">
            {current ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {current.generatedByAI && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Sparkles className="size-3 text-[var(--ai)]" /> AI-drafted
                      </Badge>
                    )}
                    <StatusBadge variant={current.status} />
                    <StatusBadge variant={current.pool} />
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Hits: {current.hits} · Miss rate: {Math.round(current.missRate * 100)}%
                  </div>
                </div>

                <h2 className="text-xl font-semibold leading-snug mt-4">{current.text}</h2>

                <div className="mt-6 space-y-2">
                  {current.options.map((o) => (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg border",
                        o.correct ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-border",
                      )}
                    >
                      <div className={cn(
                        "size-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                        o.correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30",
                      )}>
                        {o.correct && <Check className="size-3" />}
                      </div>
                      <span className="font-medium">{o.text}</span>
                      {o.correct && <Badge className="ml-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Correct</Badge>}
                    </div>
                  ))}
                </div>

                {current.explanation && (
                  <div className="mt-5 rounded-lg bg-muted/50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Explanation
                    </div>
                    <div className="text-sm">{current.explanation}</div>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-2 pt-6 border-t">
                  <Button
                    onClick={() => handleApprove(current.id)}
                    disabled={current.status === "approved" || busyId === current.id}
                    className="gap-2"
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                    className="gap-2"
                    disabled={busyId === current.id}
                  >
                    <Edit3 className="size-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRegenerate(current.id)}
                    disabled={busyId === current.id}
                    className="gap-2"
                  >
                    {busyId === current.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Regenerate with AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setHistoryOpen(true)}
                    disabled={busyId === current.id}
                    className="gap-2"
                  >
                    <History className="size-4" /> History
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReject(current.id)}
                    disabled={current.status === "rejected" || busyId === current.id}
                    className="gap-2 ml-auto text-rose-600 hover:text-rose-700"
                  >
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">Select a question to review.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {current && (
        <EditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          question={current}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}

      {current && (
        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          question={current}
          onRestored={() => {
            setHistoryOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PoolBadge({ label, count, tone }: { label: string; count: number; tone: "emerald" | "amber" | "rose" | "violet" }) {
  const dot = tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : tone === "rose" ? "bg-rose-500" : "bg-violet-500";
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot)} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono tabular-nums font-semibold">{count}</span>
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  initial: "Initial draft",
  edited: "Manual edit",
  regenerated: "Regenerated",
  approved: "Approved",
  restored: "Restored",
};

function HistoryDialog({
  open,
  onOpenChange,
  question,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question;
  onRestored: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<QuestionVersion[]>([]);
  const [restoringVersion, setRestoringVersion] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getQuestionVersions(question.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error ?? "Could not load history");
        return;
      }
      setVersions(res.versions);
    });
    return () => {
      cancelled = true;
    };
  }, [open, question.id]);

  async function handleRestore(versionNumber: number) {
    if (!window.confirm(`Restore version ${versionNumber}? The current content is saved to history first, so this is reversible.`)) {
      return;
    }
    setRestoringVersion(versionNumber);
    const res = await restoreQuestionVersion(question.id, versionNumber);
    setRestoringVersion(null);
    if (!res.ok) {
      toast.error(res.error ?? "Restore failed");
      return;
    }
    toast.success(`Restored version ${versionNumber}`);
    onRestored();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every edit, regeneration, and approval is saved here. Restore any earlier version — the current one is snapshotted first.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[460px] overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 mx-auto mb-2 animate-spin" /> Loading history…
            </div>
          ) : versions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No history yet. Versions are recorded the next time this question is edited, regenerated, or approved.
            </div>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">v{v.versionNumber}</Badge>
                    <span className="text-xs font-medium">{REASON_LABEL[v.changeReason] ?? v.changeReason}</span>
                    <span className="text-xs text-muted-foreground">· {fmtRelative(v.createdAt)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => handleRestore(v.versionNumber)}
                    disabled={restoringVersion !== null}
                  >
                    {restoringVersion === v.versionNumber ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Restore
                  </Button>
                </div>
                <p className="text-sm leading-snug">{v.text}</p>
                <ul className="mt-2 space-y-1">
                  {v.options.map((o, i) => (
                    <li
                      key={i}
                      className={cn(
                        "text-xs flex items-center gap-1.5",
                        o.correct ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground",
                      )}
                    >
                      {o.correct ? <Check className="size-3 shrink-0" /> : <span className="size-3 shrink-0" />}
                      {o.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onOpenChange,
  question,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question;
  onSaved: () => void;
}) {
  const [text, setText] = React.useState(question.text);
  const [explanation, setExplanation] = React.useState(question.explanation ?? "");
  const [options, setOptions] = React.useState(
    question.options.map((o) => ({ text: o.text, correct: o.correct })),
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setText(question.text);
      setExplanation(question.explanation ?? "");
      setOptions(question.options.map((o) => ({ text: o.text, correct: o.correct })));
    }
  }, [open, question]);

  function setOptionText(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, text: value } : o)));
  }
  function setCorrect(i: number) {
    setOptions((prev) => prev.map((o, idx) => ({ ...o, correct: idx === i })));
  }

  async function save() {
    if (options.filter((o) => o.correct).length !== 1) {
      toast.error("Mark exactly one option as correct");
      return;
    }
    setSaving(true);
    const res = await editQuestion({
      questionId: question.id,
      text,
      explanation: explanation.trim() ? explanation : null,
      options,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Save failed");
      return;
    }
    toast.success("Question saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>Edited questions are marked &ldquo;edited&rdquo; and count as approved.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Question</label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Options (mark the correct one)</label>
            <div className="space-y-2 mt-1">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(i)}
                    className={cn(
                      "size-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                      o.correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30",
                    )}
                  >
                    {o.correct && <Check className="size-3" />}
                  </button>
                  <Input value={o.text} onChange={(e) => setOptionText(i, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Explanation (optional)</label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
