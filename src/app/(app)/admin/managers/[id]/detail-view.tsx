"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Bell,
  RefreshCcw,
  Trash2,
  Mail,
  Calendar,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { initials, fmtDate, fmtRelative, fmtPct, fmtDuration } from "@/lib/format";
import { toast } from "sonner";
import { deactivateUser, reactivateUser, forceResetPassword } from "@/lib/server/admin-actions";
import { sendReminder } from "@/lib/server/reminder-actions";
import { resetManagerForModule } from "@/lib/server/module-actions";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Manager, ModuleDef, Attempt } from "@/types";
import type { DeliveryRecord } from "@/lib/db/deliveries";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface ManagerDetailViewProps {
  m: Manager;
  modules: ModuleDef[];
  myAttempts: Attempt[];
  /** Pre-fetched per-module delivery history (server-side). */
  deliveriesByModule: Record<string, DeliveryRecord[]>;
}

export function ManagerDetailView({ m, modules, myAttempts, deliveriesByModule }: ManagerDetailViewProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleSendReset() {
    if (DEMO_MODE) {
      toast.success(`Reset link sent to ${m.name} (demo)`);
      return;
    }
    const result = await forceResetPassword(m.id);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to send reset");
      return;
    }
    toast.success(`Password reset email sent to ${result.email}`);
  }

  async function handleDeactivate() {
    const isDeactivated = m.status === "inactive";
    const verb = isDeactivated ? "reactivate" : "deactivate";
    if (!confirm(`Are you sure you want to ${verb} ${m.name}?`)) return;
    if (DEMO_MODE) {
      toast.success(`${m.name} ${verb}d (demo)`);
      return;
    }
    const result = await (isDeactivated ? reactivateUser(m.id) : deactivateUser(m.id));
    if (!result.ok) {
      toast.error(result.error ?? `Failed to ${verb}`);
      return;
    }
    toast.success(`${m.name} ${verb}d`);
    router.refresh();
  }

  async function handleSendReminder() {
    setBusy(true);
    const res = await sendReminder(m.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not send reminder");
      return;
    }
    toast.success(`Reminder sent to ${m.name}`);
    router.refresh();
  }

  async function handleReassignRetake() {
    // Reset the most recent module they failed (or the latest active one).
    const failed = myAttempts.find((a) => a.status === "failed");
    if (!failed) {
      toast.error("No failed attempts to reset");
      return;
    }
    setBusy(true);
    const res = await resetManagerForModule(m.id, failed.moduleSlug);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not schedule retake");
      return;
    }
    toast.success(`Retake scheduled for ${m.name}`);
    router.refresh();
  }

  function deliveryLabelFor(moduleSlug: string, attemptStartedAt: string): { label: string; index: number; isCurrent: boolean } | null {
    const deliveries = deliveriesByModule[moduleSlug] ?? [];
    const ts = new Date(attemptStartedAt).getTime();
    const match = deliveries.find((d) => {
      const startMs = d.index === 1 ? -Infinity : new Date(d.startDate).getTime();
      const endMs = d.endDate ? new Date(d.endDate).getTime() : Infinity;
      return ts >= startMs && ts < endMs;
    });
    if (!match) return null;
    return {
      label: match.isCurrent ? `Current delivery` : `Delivery ${match.index}`,
      index: match.index,
      isCurrent: match.isCurrent,
    };
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/admin/managers"><ArrowLeft className="size-4 mr-1" /> All managers</Link>
      </Button>

      <PageHeader
        eyebrow={`${m.cohort} cohort`}
        title={m.name}
        description={m.email}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSendReminder} disabled={busy}>
              <Bell className="mr-2 size-4" /> Send reminder
            </Button>
            <Button variant="outline" onClick={handleSendReset}>
              <Mail className="mr-2 size-4" /> Send reset link
            </Button>
            <Button variant="outline" onClick={handleReassignRetake} disabled={busy}>
              <RefreshCcw className="mr-2 size-4" /> Reassign retake
            </Button>
            <Button variant="outline" className="text-rose-600" onClick={handleDeactivate}>
              <Trash2 className="mr-2 size-4" /> {m.status === "inactive" ? "Reactivate" : "Deactivate"}
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 text-center">
              <Avatar className="size-20 mx-auto border-2 border-primary/20">
                <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="text-2xl font-bold">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="font-semibold text-lg mt-3">{m.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.email}</div>
              <div className="mt-3 flex justify-center">
                <StatusBadge variant={m.status} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <Field icon={Calendar} label="Joined" value={fmtDate(m.joinedAt)} />
              <Field icon={Clock} label="Last active" value={fmtRelative(m.lastActiveAt)} />
              <Field icon={Trophy} label="Modules passed" value={`${m.modulesCompleted} of 5`} />
              <Field icon={Trophy} label="Avg score" value={m.averageScore ? `${m.averageScore}%` : "—"} />
              {m.failedAttempts > 0 && (
                <Field icon={AlertTriangle} label="Failed attempts" value={String(m.failedAttempts)} highlight="warning" />
              )}
            </CardContent>
          </Card>

          {m.flaggedReasons.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" /> Flagged
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1.5">
                  {m.flaggedReasons.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Program timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {modules.map((mod) => {
                  const att = myAttempts.filter((a) => a.moduleSlug === mod.slug);
                  const passed = att.some((a) => a.status === "passed");
                  const failed = att.some((a) => a.status === "failed") && !passed;
                  return (
                    <li key={mod.slug} className="px-5 py-4 flex items-center gap-4">
                      <div className={`size-10 rounded-md flex items-center justify-center shrink-0
                        ${passed ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : failed ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                          : "bg-muted text-muted-foreground"}`}>
                        {passed ? <CheckCircle2 className="size-5" /> : failed ? <AlertTriangle className="size-5" /> : <Calendar className="size-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">M{mod.number}</span>
                          <span className="font-medium">{mod.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {att.length === 0
                            ? mod.scheduledDate
                              ? `Scheduled ${fmtDate(mod.scheduledDate)}`
                              : "Not scheduled yet"
                            : `${att.length} attempt${att.length === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {att.map((a) => (
                          <Badge key={a.id} variant="outline" className="font-mono text-xs">
                            {a.pool === "retake" ? "RT" : "FA"}: {fmtPct(a.scorePct)}
                          </Badge>
                        ))}
                        {passed && <StatusBadge variant="passed" />}
                        {failed && <StatusBadge variant="failed" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attempt history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myAttempts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No attempts yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-y bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Module</th>
                      <th className="text-left px-5 py-2.5 font-medium">Delivery</th>
                      <th className="text-left px-5 py-2.5 font-medium">Date</th>
                      <th className="text-left px-5 py-2.5 font-medium">Pool</th>
                      <th className="text-left px-5 py-2.5 font-medium">Score</th>
                      <th className="text-left px-5 py-2.5 font-medium">Time</th>
                      <th className="text-left px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {myAttempts.map((a) => {
                      const mod = modules.find((mm) => mm.slug === a.moduleSlug);
                      const dl = deliveryLabelFor(a.moduleSlug, a.startedAt);
                      return (
                        <tr key={a.id} className="hover:bg-accent/40">
                          <td className="px-5 py-3 font-medium">{mod?.title ?? a.moduleSlug}</td>
                          <td className="px-5 py-3">
                            {dl ? (
                              <Badge variant={dl.isCurrent ? "default" : "secondary"} className="font-mono text-[10px]">
                                D{dl.index}{dl.isCurrent ? " · current" : ""}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{fmtRelative(a.startedAt)}</td>
                          <td className="px-5 py-3"><StatusBadge variant={a.pool} /></td>
                          <td className="px-5 py-3 font-mono tabular-nums">{fmtPct(a.scorePct)}</td>
                          <td className="px-5 py-3 text-muted-foreground tabular-nums">{fmtDuration(a.durationSec)}</td>
                          <td className="px-5 py-3"><StatusBadge variant={a.status as "passed" | "failed"} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; highlight?: "warning" }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${highlight === "warning" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
        <Icon className="size-3.5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
