"use client";

// In-app preview for an email template. Renders the markdown body to the same
// HTML an actual send produces (via the shared renderMarkdown/substituteVars),
// substituting editable sample values. Variables are auto-detected from the
// subject + body, and seeded from the shared buildSampleVars() so the preview
// matches "Send test to me".

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";
import { renderMarkdown, substituteVars } from "@/lib/emails/render";
import { buildSampleVars } from "@/lib/emails/sample-vars";

function extractVars(...sources: string[]): string[] {
  const found = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  for (const s of sources) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) found.add(m[1]);
  }
  return [...found];
}

interface EmailPreviewDialogProps {
  subject: string;
  bodyMarkdown: string;
  trigger?: React.ReactNode;
}

export function EmailPreviewDialog({ subject, bodyMarkdown, trigger }: EmailPreviewDialogProps) {
  const [open, setOpen] = React.useState(false);
  const usedVars = React.useMemo(
    () => extractVars(subject, bodyMarkdown),
    [subject, bodyMarkdown],
  );
  const [vars, setVars] = React.useState<Record<string, string>>({});

  // Seed any not-yet-set variables with shared sample defaults when opening.
  React.useEffect(() => {
    if (!open) return;
    const defaults = buildSampleVars({ appUrl: process.env.NEXT_PUBLIC_APP_URL });
    setVars((prev) => {
      const next = { ...prev };
      for (const k of usedVars) {
        if (next[k] === undefined) next[k] = defaults[k] ?? "";
      }
      return next;
    });
  }, [open, usedVars]);

  const subjectOut = substituteVars(subject, vars);
  const html = renderMarkdown(substituteVars(bodyMarkdown, vars));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Eye aria-hidden="true" className="size-3.5 mr-1.5" /> Preview
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Email preview</DialogTitle>
          <DialogDescription>
            Rendered with sample values. Edit any value to see it update live.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[200px_1fr] gap-4">
          <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            <p className="text-xs font-medium text-muted-foreground">Sample values</p>
            {usedVars.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No variables in this template.
              </p>
            ) : (
              usedVars.map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px] font-mono">{k}</Label>
                  <Input
                    value={vars[k] ?? ""}
                    onChange={(e) =>
                      setVars((p) => ({ ...p, [k]: e.target.value }))
                    }
                    className="h-7 text-xs"
                  />
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <p className="text-sm font-medium break-words">{subjectOut}</p>
            </div>
            <iframe
              srcDoc={html}
              title="Email preview"
              className="w-full h-[400px] rounded-md border bg-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
