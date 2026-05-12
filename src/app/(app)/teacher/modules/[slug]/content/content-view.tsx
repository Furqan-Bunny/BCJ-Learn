"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PresentationIcon, Save, Sparkles, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LessonsBuilder } from "@/components/admin/lessons-builder";
import { updateModuleLessons } from "@/lib/server/module-actions";
import type { Lesson, ModuleDef } from "@/types";
import { toast } from "sonner";

export function TeacherContentView({ mod }: { mod: ModuleDef }) {
  const router = useRouter();
  const slug = mod.slug;
  const [lessons, setLessons] = React.useState<Lesson[]>(mod.lessons);
  const [saving, setSaving] = React.useState(false);

  const totalMinutes = lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const totalItems = lessons.reduce((s, l) => s + l.contents.length, 0);
  const dirty = JSON.stringify(lessons) !== JSON.stringify(mod.lessons);

  async function handleSave() {
    setSaving(true);
    const res = await updateModuleLessons(slug, lessons);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save");
      return;
    }
    toast.success("Content saved", {
      description: `${lessons.length} lessons · ${totalItems} items · ${totalMinutes} min total.`,
    });
    router.refresh();
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/teacher/modules/${slug}`}><ArrowLeft className="size-4 mr-1" /> Back to module</Link>
      </Button>

      <PageHeader
        eyebrow={`Module ${mod.number} · ${mod.scheduledMonth}`}
        title={`Edit content — ${mod.title}`}
        description="Organize the seminar into lessons and add the videos, documents, slide decks, or links you'll present in each."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/teacher/modules/${slug}/present`}>
                <PresentationIcon className="mr-2 size-4" /> Open presenter
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="mr-2 size-4" /> {dirty ? "Save changes" : "Saved"}</>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Lessons" value={String(lessons.length)} />
        <SummaryCard label="Content items" value={String(totalItems)} />
        <SummaryCard label="Total length" value={`${totalMinutes} min`} />
        <SummaryCard label="Status" value={mod.status} statusVariant={mod.status} />
      </div>

      <Card className="mb-6 border-[var(--ai)]/30 bg-[var(--ai)]/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="size-5 text-[var(--ai)] shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">Tip — AI from content.</span>
            <span className="text-muted-foreground"> Once you upload videos and documents, AI can transcribe the videos and use both as source material to draft your quiz question bank. Review them in <Link href={`/teacher/modules/${slug}/questions`} className="text-primary hover:underline">Questions</Link>.</span>
          </div>
        </CardContent>
      </Card>

      <LessonsBuilder
        lessons={lessons}
        onChange={setLessons}
        moduleSlug={slug}
      />

      {dirty && (
        <div className="sticky bottom-4 mt-8 z-30">
          <Card className="border-primary shadow-lg">
            <CardContent className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-medium">Unsaved changes</span>
                <span className="text-muted-foreground"> — review and save when ready.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLessons(mod.lessons)}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="mr-1.5 size-3.5" /> Save changes</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  statusVariant,
}: {
  label: string;
  value: string;
  statusVariant?: "draft" | "published" | "archived";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        {statusVariant ? (
          <div className="mt-2">
            <StatusBadge variant={statusVariant} />
          </div>
        ) : (
          <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
