"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, AlertCircle, Calendar, Users, UserPlus, RefreshCw, Mail } from "lucide-react";
import { useAttendanceStore } from "@/store/attendance-store";
import { moduleBySlug } from "@/data/modules";
import { managers } from "@/data/users";
import { attempts } from "@/data/attempts";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

interface ScheduleRedeliveryProps {
  moduleSlug: string;
  trigger?: React.ReactNode;
}

export function ScheduleRedelivery({ moduleSlug, trigger }: ScheduleRedeliveryProps) {
  const mod = moduleBySlug(moduleSlug);
  const deliveryStartMap = useAttendanceStore((s) => s.deliveryStartDate);
  const checkedInMap = useAttendanceStore((s) => s.checkedIn);
  const scheduleNewDelivery = useAttendanceStore((s) => s.scheduleNewDelivery);
  const currentDeliveryStart = deliveryStartMap[moduleSlug];
  const checkedInIds = checkedInMap[moduleSlug] ?? [];

  const [open, setOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // Default to today
      const today = new Date();
      setNewDate(today.toISOString().split("T")[0]);
    }
  }, [open]);

  if (!mod) return null;

  const effectiveCurrent = currentDeliveryStart ?? mod.scheduledDate;

  // Auto-invite preview: who will be invited to the new delivery?
  // Categorize them so admin/teacher knows where each invitee came from.
  const passedManagerIds = new Set(
    attempts.filter((a) => a.moduleSlug === moduleSlug && a.status === "passed").map((a) => a.managerId),
  );
  const failedManagerIds = new Set(
    attempts
      .filter((a) => a.moduleSlug === moduleSlug && a.status === "failed")
      .map((a) => a.managerId),
  );
  const moduleStartTs = new Date(mod.scheduledDate).getTime();

  const inviteeCategories = managers.reduce(
    (acc, m) => {
      if (passedManagerIds.has(m.id)) return acc; // already passed → skip
      const joined = new Date(m.joinedAt).getTime();
      const isNewHire = joined > moduleStartTs;
      const failedBefore = failedManagerIds.has(m.id);
      if (isNewHire && !failedBefore) {
        acc.newHires.push(m.id);
      } else if (failedBefore) {
        acc.retakes.push(m.id);
      } else {
        acc.missed.push(m.id);
      }
      return acc;
    },
    { newHires: [] as string[], retakes: [] as string[], missed: [] as string[] },
  );
  const totalInvitees =
    inviteeCategories.newHires.length + inviteeCategories.retakes.length + inviteeCategories.missed.length;

  function handleConfirm() {
    setSubmitting(true);
    setTimeout(() => {
      const isoDate = newDate ? new Date(newDate + "T09:00:00").toISOString() : new Date().toISOString();
      scheduleNewDelivery(moduleSlug, isoDate);
      setSubmitting(false);
      setOpen(false);
      toast.success(`${mod!.title} re-delivered`, {
        description: `New session: ${fmtDate(isoDate)} · ${totalInvitees} invitations queued (${inviteeCategories.retakes.length} retakes, ${inviteeCategories.newHires.length} new hires, ${inviteeCategories.missed.length} previously absent). Past attempts kept in history.`,
      });
    }, 500);
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
          <DialogTitle>Re-deliver {mod.title}</DialogTitle>
          <DialogDescription>
            Schedule a new delivery date for this module without creating a duplicate. The cohort resets so everyone can attend fresh — past attempts stay in history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current delivery info */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Current delivery start:</span>
              <span className="font-medium">{fmtDate(effectiveCurrent)}</span>
            </div>
            {checkedInIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Currently checked in:</span>
                <span className="font-medium">{checkedInIds.length} manager{checkedInIds.length === 1 ? "" : "s"}</span>
              </div>
            )}
          </div>

          {/* New date picker */}
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
              Defaults to today. Pick the date the seminar will run again (e.g., refresher · new-hire cohort · makeup).
            </p>
          </div>

          {/* Auto-invite preview */}
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Mail className="size-4 text-primary" />
              <span className="text-sm font-semibold">
                System will auto-invite {totalInvitees} manager{totalInvitees === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-start gap-2">
                <RefreshCw className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{inviteeCategories.retakes.length}</span> who failed a previous attempt — auto-invited for the retake
                </span>
              </li>
              <li className="flex items-start gap-2">
                <UserPlus className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{inviteeCategories.newHires.length}</span> new hire{inviteeCategories.newHires.length === 1 ? "" : "s"} who joined after the original delivery
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">{inviteeCategories.missed.length}</span> who missed previous deliveries entirely
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground border-t pt-2.5">
              Already-passed employees are <span className="font-medium text-foreground">not</span> re-invited (they passed once — no need to retake).
              Each invitee gets an email with the new date and the check-in flow.
            </p>
          </div>

          {/* Effects on existing data */}
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!newDate || submitting}>
            {submitting ? "Scheduling…" : "Confirm re-delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
