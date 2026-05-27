"use client";

// Module-page entry point for interactive AI question generation. Wraps the
// shared QuestionReviewPanel in a dialog with a "Done" footer.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { QuestionReviewPanel } from "@/components/admin/question-review-panel";

export function GenerateQuestionsDialog({
  moduleSlug, moduleTitle, trigger, onDone,
}: {
  moduleSlug: string;
  moduleTitle: string;
  trigger?: React.ReactNode;
  onDone?: (added: number) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [added, setAdded] = React.useState(0);

  function handleClose() {
    setOpen(false);
    if (added > 0) router.refresh();
    onDone?.(added);
    setTimeout(() => setAdded(0), 200);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        {trigger ?? (<Button variant="outline" size="sm"><Sparkles className="size-3.5 mr-1.5 text-[var(--ai)]" /> Generate with AI</Button>)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-[var(--ai)]" /> AI questions — {moduleTitle}</DialogTitle>
          <DialogDescription>Review each question — Add it to keep, Skip to discard. AI keeps drafting.</DialogDescription>
        </DialogHeader>

        {open && <QuestionReviewPanel moduleSlug={moduleSlug} onAddedChange={setAdded} />}

        <DialogFooter>
          <Button variant={added > 0 ? "default" : "outline"} onClick={handleClose}>
            {added > 0 ? <><Check className="size-4 mr-1.5" /> Done · {added} added</> : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
