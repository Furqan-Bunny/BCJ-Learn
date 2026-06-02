"use client";

// Guided, state-aware setup steps shown at the top of the admin module page so
// an admin always knows what to do next: add content → generate & review
// questions → publish → send to employees.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Loader2, BookOpen, ListChecks, Rocket, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { publishModule, unpublishModule } from "@/lib/server/module-actions";
import { ScheduleRedelivery } from "@/components/admin/schedule-redelivery";
import { RescheduleSeminar } from "@/components/admin/reschedule-seminar";
import { GenerateQuestionsDialog } from "@/components/admin/generate-questions-dialog";

interface ModuleSetupPanelProps {
  slug: string;
  moduleTitle: string;
  status: string;
  lessonCount: number;
  contentItemCount: number;
  questionsApproved: number;
  questionsTotal: number;
  questionCount: number; // target quiz length
  currentDeliveryStart: string | null;
  attendeeCount: number;
}

export function ModuleSetupPanel({
  slug,
  moduleTitle,
  status,
  lessonCount,
  contentItemCount,
  questionsApproved,
  questionsTotal,
  questionCount,
  currentDeliveryStart,
  attendeeCount,
}: ModuleSetupPanelProps) {
  const router = useRouter();
  const [publishing, setPublishing] = React.useState(false);

  const isPublished = status === "published";
  const hasContent = contentItemCount > 0;
  const enoughApproved = questionsApproved >= questionCount && questionCount > 0;
  const hasSeminar = !!currentDeliveryStart;

  async function handlePublish() {
    if (!enoughApproved && !confirm(`Only ${questionsApproved} of ${questionCount} questions are approved. Publish anyway?`)) return;
    setPublishing(true);
    const res = await publishModule(slug);
    setPublishing(false);
    if (!res.ok) { toast.error(res.error ?? "Could not publish"); return; }
    toast.success(`${moduleTitle} published`);
    router.refresh();
  }

  async function handleUnpublish() {
    if (!confirm("Set this module back to draft? Employees won't be able to take it until you publish again.")) return;
    setPublishing(true);
    const res = await unpublishModule(slug);
    setPublishing(false);
    if (!res.ok) { toast.error(res.error ?? "Could not unpublish"); return; }
    toast.success(`${moduleTitle} set back to draft`);
    router.refresh();
  }

  return (
    <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            <h3 className="font-semibold tracking-tight">Module setup</h3>
          </div>
          <Badge variant={isPublished ? "default" : "secondary"} className="capitalize">
            {isPublished ? "Published — live" : "Draft — not live yet"}
          </Badge>
        </div>

        <div className="space-y-3">
          {/* 1. Content */}
          <Step
            n={1}
            done={hasContent}
            title="Add learning content"
            desc={hasContent ? `${lessonCount} lessons · ${contentItemCount} items` : "Upload videos / documents — AI uses these to write the quiz."}
          >
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/modules/${slug}/content?from=admin`}>
                <BookOpen className="size-3.5 mr-1.5" /> Edit content
              </Link>
            </Button>
          </Step>

          {/* 2. Questions */}
          <Step
            n={2}
            done={enoughApproved}
            title="Generate & approve quiz questions"
            desc={questionsTotal === 0 ? "No questions yet — let AI draft them." : `${questionsApproved}/${questionCount} approved · ${questionsTotal} drafted`}
          >
            <GenerateQuestionsDialog
              moduleSlug={slug}
              moduleTitle={moduleTitle}
              trigger={<Button variant="outline" size="sm"><Sparkles className="size-3.5 mr-1.5 text-[var(--ai)]" /> Generate with AI</Button>}
            />
            {questionsTotal > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/teacher/modules/${slug}/questions`}>
                  <ListChecks className="size-3.5 mr-1.5" /> Review & approve
                </Link>
              </Button>
            )}
          </Step>

          {/* 3. Choose employees & schedule */}
          <Step
            n={3}
            done={hasSeminar}
            title="Choose employees & schedule the seminar"
            desc={hasSeminar ? `${attendeeCount} on the current roster.` : "Pick who attends and set the seminar date."}
          >
            {hasSeminar && (
              <RescheduleSeminar moduleSlug={slug} moduleTitle={moduleTitle} attendeeCount={attendeeCount} />
            )}
            <ScheduleRedelivery
              moduleSlug={slug}
              moduleTitle={moduleTitle}
              currentDeliveryStart={currentDeliveryStart}
            />
          </Step>

          {/* 4. Publish (last) */}
          <Step
            n={4}
            done={isPublished}
            title="Publish the module"
            desc={isPublished ? "Live — employees can take it." : "Final step — make it live for the assigned employees."}
          >
            {isPublished ? (
              <Button variant="ghost" size="sm" onClick={handleUnpublish} disabled={publishing}>
                <Undo2 className="size-3.5 mr-1.5" /> Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                {publishing ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Publishing…</> : <><Rocket className="size-3.5 mr-1.5" /> Publish module</>}
              </Button>
            )}
          </Step>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({
  n,
  done,
  title,
  desc,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div
        className={cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5",
          done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-primary/10 text-primary",
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
        {children}
      </div>
    </div>
  );
}
