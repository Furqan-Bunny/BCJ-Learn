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
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw, AlertCircle, Calendar, Mail, Loader2, Users } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { getDueEmployees, scheduleSeminar, notifySeminar } from "@/lib/server/module-actions";
import { TIMEZONES, defaultTimezone } from "@/lib/timezones";

interface DueEmployee { id: string; name: string; email: string; cohort: string | null }

interface ScheduleRedeliveryProps {
  moduleSlug: string;
  /** Module title — passed in for the dialog copy. */
  moduleTitle: string;
  /** Current delivery's start date (ISO). */
  currentDeliveryStart: string | null;
  /** Count of currently checked-in managers (display only). */
  checkedInCount?: number;
  /** Accepted for back-compat; the attendee list is fetched live. */
  pendingCount?: number;
  /** Pre-fill the form from the module's current seminar. */
  moduleDate?: string;
  moduleTime?: string;
  moduleTz?: string;
  trigger?: React.ReactNode;
}

export function ScheduleRedelivery({
  moduleSlug,
  moduleTitle,
  currentDeliveryStart,
  checkedInCount = 0,
  moduleDate,
  moduleTime,
  moduleTz,
  trigger,
}: ScheduleRedeliveryProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [tz, setTz] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [employees, setEmployees] = React.useState<DueEmployee[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [notify, setNotify] = React.useState<{ sent: number; total: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setNewDate(moduleDate || new Date().toISOString().split("T")[0]);
    setNewTime(moduleTime || "");
    setTz(moduleTz || defaultTimezone());
    setLoading(true);
    getDueEmployees(moduleSlug).then((res) => {
      if (res.ok) {
        setEmployees(res.employees);
        setSelected(new Set(res.employees.map((e) => e.id)));
      } else {
        toast.error(res.error ?? "Could not load managers");
      }
      setLoading(false);
    });
  }, [open, moduleSlug, moduleDate, moduleTime, moduleTz]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = employees.length > 0 && selected.size === employees.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }

  async function notifyInBatches(recipients: { id: string }[]): Promise<number> {
    const ids = recipients.map((r) => r.id);
    if (ids.length === 0) return 0;
    setNotify({ sent: 0, total: ids.length });
    const CHUNK = 5;
    let sent = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const r = await notifySeminar(moduleSlug, "scheduled", ids.slice(i, i + CHUNK));
      sent += r.sent ?? 0;
      setNotify({ sent, total: ids.length });
    }
    return sent;
  }

  async function handleConfirm() {
    if (!newDate) return;
    setSubmitting(true);
    const res = await scheduleSeminar(moduleSlug, newDate, [...selected], newTime || null, tz || null);
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error ?? "Could not schedule seminar");
      return;
    }
    const sent = await notifyInBatches(res.recipients);
    setSubmitting(false);
    setNotify(null);
    setOpen(false);
    toast.success(`Seminar scheduled for ${moduleTitle}`, {
      description: `${fmtDate(newDate)} · ${res.invited} invited${sent ? `, ${sent} emailed` : ""}.`,
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <RotateCcw className="size-4 mr-2" /> Schedule seminar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider mb-2">
            Schedule seminar
          </Badge>
          <DialogTitle>Schedule seminar — {moduleTitle}</DialogTitle>
          <DialogDescription>
            These managers haven&rsquo;t passed in the last 12 months. Uncheck anyone you don&rsquo;t want, pick the date, and they&rsquo;ll get an email about the seminar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-delivery-date">Seminar date</Label>
              <Input
                id="new-delivery-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-delivery-time">Start time</Label>
              <Input
                id="new-delivery-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-delivery-tz">Time zone</Label>
            <select id="new-delivery-tz" value={tz} onChange={(e) => setTz(e.target.value)}
              className="h-10 w-full rounded-md border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                {loading ? "Loading…" : `${selected.size} of ${employees.length} selected`}
              </span>
              {employees.length > 0 && (
                <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </div>
              ) : employees.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Everyone&rsquo;s current — no one is due for this seminar.
                </div>
              ) : (
                employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.email}{e.cohort ? ` · ${e.cohort}` : ""}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 flex items-start gap-2">
            <Mail className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              The {selected.size} selected manager{selected.size === 1 ? "" : "s"} will be invited and emailed
              about the {newDate ? fmtDate(newDate) : "seminar"} session. Past attempts stay in history; current
              check-ins reset.
            </p>
          </div>

          {checkedInCount > 0 && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5" /> {checkedInCount} current check-in{checkedInCount === 1 ? "" : "s"} will be cleared.
            </p>
          )}
          {currentDeliveryStart && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Current delivery started {fmtDate(currentDeliveryStart)}.
            </p>
          )}
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
              Emailing managers… {notify.sent} of {notify.total}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!newDate || submitting || loading}>
            {submitting ? (
              notify ? (
                <><Loader2 className="size-4 animate-spin mr-1.5" /> Emailing {notify.sent}/{notify.total}…</>
              ) : (
                <><Loader2 className="size-4 animate-spin mr-1.5" /> Scheduling…</>
              )
            ) : (
              `Schedule & notify ${selected.size}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
