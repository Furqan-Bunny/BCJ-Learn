"use client";

import * as React from "react";
import { use } from "react";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, RefreshCw, Edit3, Sparkles, Search, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { moduleBySlug } from "@/data/modules";
import { questionsForModule } from "@/data/questions";
import type { Question, QuestionPool, QuestionStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TeacherQuestionsPage(props: PageProps<"/teacher/modules/[slug]/questions">) {
  const { slug } = use(props.params);
  const mod = moduleBySlug(slug);
  if (!mod) return notFound();

  const initial = React.useMemo(() => questionsForModule(slug), [slug]);
  const [questions, setQuestions] = React.useState<Question[]>(initial);
  const [pool, setPool] = React.useState<QuestionPool | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<QuestionStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(initial[0]?.id ?? null);

  const filtered = questions.filter((q) => {
    if (pool !== "all" && q.pool !== pool) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const current = questions.find((q) => q.id === selected) ?? filtered[0];

  function update(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function approve(id: string) {
    update(id, { status: "approved", approvedAt: new Date().toISOString() });
    toast.success("Question approved");
  }
  function reject(id: string) {
    update(id, { status: "rejected" });
    toast("Question rejected");
  }
  function regenerate(id: string) {
    toast.loading("AI re-drafting…", { id: `regen-${id}` });
    setTimeout(() => {
      update(id, {
        status: "pending",
        text: "Re-drafted: " + (questions.find((q) => q.id === id)?.text ?? ""),
      });
      toast.success("AI generated a new draft", { id: `regen-${id}` });
    }, 800);
  }

  const counts = {
    all: questions.length,
    pending: questions.filter((q) => q.status === "pending").length,
    approved: questions.filter((q) => q.status === "approved").length,
    rejected: questions.filter((q) => q.status === "rejected").length,
    edited: questions.filter((q) => q.status === "edited").length,
  };

  const approvedPct = Math.round((counts.approved / counts.all) * 100);

  return (
    <>
      <PageHeader
        eyebrow={`Module ${mod.number} — Question review`}
        title={mod.title}
        description="Review every AI-drafted question. Approve, edit, regenerate, or reject. Only approved questions go live."
        actions={
          <Button onClick={() => toast.success(`Module ${mod.number} published`)}>
            Publish ({counts.approved}/{counts.all})
          </Button>
        }
      />

      {/* Progress strip */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-[var(--ai)]" />
              <span className="font-medium">AI-drafted question bank</span>
              <Badge variant="outline" className="ml-1 text-[10px]">{counts.all} total</Badge>
            </div>
            <div className="text-sm font-mono tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{counts.approved}</span> approved
              <span className="text-muted-foreground"> · {approvedPct}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${approvedPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <PoolBadge label="Pending" count={counts.pending} className="text-amber-600" />
            <PoolBadge label="Approved" count={counts.approved} className="text-emerald-600" />
            <PoolBadge label="Edited" count={counts.edited} className="text-violet-600" />
            <PoolBadge label="Rejected" count={counts.rejected} className="text-rose-600" />
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
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

      {/* Split pane */}
      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {/* Question list */}
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Question queue
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="size-6 mx-auto mb-2 opacity-50" />
                No questions match your filters.
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

        {/* Question detail */}
        <Card>
          <CardContent className="p-6 md:p-8">
            {current ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Sparkles className="size-3 text-[var(--ai)]" /> AI-drafted
                    </Badge>
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

                {/* Actions */}
                <div className="mt-8 flex flex-wrap items-center gap-2 pt-6 border-t">
                  <Button
                    onClick={() => approve(current.id)}
                    disabled={current.status === "approved"}
                    className="gap-2"
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast.info("Edit drawer (mocked)")}
                    className="gap-2"
                  >
                    <Edit3 className="size-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => regenerate(current.id)}
                    className="gap-2"
                  >
                    <RefreshCw className="size-4" /> Regenerate with AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reject(current.id)}
                    disabled={current.status === "rejected"}
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
    </>
  );
}

function PoolBadge({ label, count, className }: { label: string; count: number; className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className?.includes("emerald") && "bg-emerald-500", className?.includes("amber") && "bg-amber-500", className?.includes("rose") && "bg-rose-500", className?.includes("violet") && "bg-violet-500")} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono tabular-nums font-semibold">{count}</span>
    </div>
  );
}
