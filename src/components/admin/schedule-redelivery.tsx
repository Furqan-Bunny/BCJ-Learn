"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertCircle, Calendar, Mail, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { scheduleRedelivery } from "@/lib/server/module-actions";

interface ScheduleRedeliveryProps {
  moduleSlug: string;
  /** Module title — passed in for the dialog copy. */
  moduleTitle: string;
  /** Current delivery's start date (ISO). */
  currentDeliveryStart: string | null;
  /** Count of currently checked-in managers (display only). */
  checkedInCount?: number;
  /** Count of managers who haven't yet passed — they'll be auto-invited by the RPC. */
  pendingCount?: number;
  trigger?: React.ReactNode;
}

export function ScheduleRedelivery({
  moduleSlug,
  moduleTitle,
  currentDeliveryStart,
  checkedInCount = 0,
  pendingCount = 0,
  trigger,
}: ScheduleRedeliveryProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const today = new Date();
      setNewDate(today.toISOString().split("T")[0]);
    }
  }, [open]);

  async function handleConfirm() {
    if (!newDate) return;
    setSubmitting(true);
    const res = await scheduleRedelivery(moduleSlug, newDate);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not schedule re-delivery");
      return;
    }
    setOpen(false);
    toast.success(`${moduleTitle} re-delivered`, {
      description: `New session: ${fmtDate(newDate)}. Past attempts kept in history; invitees auto-rebuilt.`,
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <RotateCcw className="size-4 mr-2" /> Schedule next delivery
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider mb-2">
            Re-deliver module
          </Badge>
          <DialogTitle>Re-deliver {moduleTitle}</DialogTitle>
          <DialogDescription>
            Schedule a new delivery date for this module without creating a duplicate. The cohort resets so everyone can attend fresh — past attempts stay in history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Current delivery start:</span>
              <span className="font-medium">
                {currentDeliveryStart ? fmtDate(currentDeliveryStart) : "Not yet started"}
              </span>
            </div>
            {checkedInCount > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                {checkedInCount} manager{checkedInCount === 1 ? "" : "s"} currently checked in — they&rsquo;ll be cleared on confirm.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-delivery-date">New delivery date</Label>
            <Input
              id="new-delivery-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to today. Pick the date the seminar will run again (refresher · new-hire cohort · makeup).
            </p>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="size-4 text-primary" />
              <span className="text-sm font-semibold">
                System will auto-invite ~{pendingCount} manager{pendingCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The SQL RPC <code className="font-mono">schedule_redelivery</code> auto-invites every manager who has not yet
              passed this module. Already-passed managers are skipped.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="font-semibold text-foreground">Also:</div>
                <ul className="space-y-0.5">
                  <li>• Current check-ins for this module are cleared</li>
                  <li>• <span className="font-medium text-foreground">Past quiz attempts stay</span> in history</li>
                  <li>• Roster funnel resets to track the new delivery</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!newDate || submitting}>
            {submitting ? (
              <><Loader2 className="size-4 animate-spin mr-1.5" /> Scheduling…</>
            ) : (
              "Confirm re-delivery"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
