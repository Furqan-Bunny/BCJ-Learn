"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, RefreshCcw, ArrowRight, X, Clock, TrendingDown, Calendar, FileQuestion, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { atRiskManagers } from "@/data/queries";
import { initials, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { Stagger, StaggerItem } from "@/components/shared/animations";

const FLAG_RULES = [
  {
    icon: X,
    title: "Failed twice on a module",
    description: "Couldn't pass the first attempt or the easier retake — needs a coaching session.",
  },
  {
    icon: Calendar,
    title: "Missed a deadline",
    description: "Didn't take the quiz on the scheduled training day — no attempt logged.",
  },
  {
    icon: Clock,
    title: "Hasn't logged in 14+ days",
    description: "Disengaged — may need a check-in to confirm they're still on the team.",
  },
  {
    icon: TrendingDown,
    title: "First attempt below 70%",
    description: "Even when they passed eventually, the gap suggests the material didn't land.",
  },
  {
    icon: FileQuestion,
    title: "No quiz attempt for an assigned module",
    description: "Assigned but never started — may have missed the email invite.",
  },
];

export default function AtRiskPage() {
  const [showRules, setShowRules] = React.useState(false);
  const list = atRiskManagers();
  return (
    <>
      <PageHeader
        eyebrow="Triage"
        title="At-risk managers"
        description="Auto-flagged because they failed twice, missed deadlines, or have not logged in. Action needed."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowRules((v) => !v)}>
              <Info className="mr-2 size-4" /> {showRules ? "Hide" : "What is at-risk?"}
            </Button>
            <Button onClick={() => toast.success(`Bulk reminder sent to ${list.length} managers`)}>
              <Bell className="mr-2 size-4" /> Send reminder to all
            </Button>
          </div>
        }
      />

      {/* Explanation panel — toggleable */}
      {showRules && (
        <Card className="mb-6 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-md bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <div className="font-semibold">How BCJ Learn flags an Account Manager</div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  An Account Manager is auto-flagged as <span className="font-medium text-foreground">at-risk</span> when any of the following is true. Flags clear automatically once the manager passes a retake or logs back in.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {FLAG_RULES.map((rule) => (
                <div key={rule.title} className="flex items-start gap-3 p-3 rounded-md bg-background border">
                  <div className="size-8 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <rule.icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{rule.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{rule.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Why this exists:</span> Nancy and Isabel asked us to surface trouble early so coaching happens before someone falls behind a whole cohort.
            </div>
          </CardContent>
        </Card>
      )}

      <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((m) => (
          <StaggerItem key={m.id}>
          <Card className="border-amber-500/30 card-lift">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="size-12 border">
                  <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="font-semibold">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  <Badge variant="secondary" className="mt-1.5">{m.cohort}</Badge>
                </div>
                <div className="size-9 rounded-md bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="size-4" />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {m.flaggedReasons.map((r, i) => (
                  <div key={i} className="text-sm flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span className="text-foreground/80">{r}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Last active {fmtRelative(m.lastActiveAt)}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/admin/managers/${m.id}`}>
                    View profile <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast(`Retake scheduled for ${m.name}`)}>
                  <RefreshCcw className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.success(`Reminder sent to ${m.name}`)}>
                  <Bell className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {list.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="size-10 mx-auto mb-3 opacity-30" />
          No managers are currently at risk. Nice work!
        </div>
      )}
    </>
  );
}
