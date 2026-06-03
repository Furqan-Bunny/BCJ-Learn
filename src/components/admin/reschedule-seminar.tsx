"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2, Mail } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { rescheduleSeminar, notifySeminar } from "@/lib/server/module-actions";

interface RescheduleSeminarProps {
  moduleSlug: string;
  moduleTitle: string;
  /** Number of already-invited attendees (display only). */
  attendeeCount?: number;
  trigger?: React.ReactNode;
}

export function RescheduleSeminar({ moduleSlug, moduleTitle, attendeeCount = 0, trigger }: RescheduleSeminarProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [notify, setNotify] = React.useState<{ sent: number; total: number } | null>(null);

  React.useEffect(() => {
    if (open) setDate(new Date().toISOString().split("T")[0]);
  }, [open]);

  async function notifyInBatches(recipients: { id: string }[]): Promise<number> {
    const ids = recipients.map((r) => r.id);
    if (ids.length === 0) return 0;
    setNotify({ sent: 0, total: ids.length });
    const CHUNK = 5;
    let sent = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const r = await notifySeminar(moduleSlug, "rescheduled", ids.slice(i, i + CHUNK));
      sent += r.sent ?? 0;
      setNotify({ sent, total: ids.length });
    }
    return sent;
  }

  async function handleConfirm() {
    if (!date) return;
    setSubmitting(true);
    const res = await rescheduleSeminar(moduleSlug, date, time || null);
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error ?? "Could not reschedule");
      return;
    }
    const sent = await notifyInBatches(res.recipients);
    setSubmitting(false);
    setNotify(null);
    setOpen(false);
    toast.success(`Seminar moved to ${fmtDate(date)}`, {
      description: sent ? `${sent} attendee${sent === 1 ? "" : "s"} emailed the new date.` : undefined,
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <CalendarClock className="size-4 mr-2" /> Reschedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule seminar — {moduleTitle}</DialogTitle>
          <DialogDescription>
            Move this seminar to a new date. The same attendees stay invited and get an email about the new date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">New date</Label>
              <Input id="reschedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-time">Start time</Label>
              <Input id="reschedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 flex items-start gap-2">
            <Mail className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              {attendeeCount > 0
                ? `The ${attendeeCount} already-invited attendee${attendeeCount === 1 ? "" : "s"} will be emailed the new date.`
                : "Invited attendees will be emailed the new date."}
            </p>
          </div>
        </div>

        {notify && (
          <div className="px-1 pb-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${notify.total ? (notify.sent / notify.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Emailing attendees… {notify.sent} of {notify.total}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!date || submitting}>
            {submitting ? (
              notify ? (
                <><Loader2 className="size-4 animate-spin mr-1.5" /> Emailing {notify.sent}/{notify.total}…</>
              ) : (
                <><Loader2 className="size-4 animate-spin mr-1.5" /> Rescheduling…</>
              )
            ) : (
              "Reschedule & notify"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
