"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Sparkles, Users, Bell, FileText, AlertTriangle, Search, RotateCcw, UserCheck, Play, Square } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { activity } from "@/data/activity";
import { allUsers } from "@/data/users";
import { fmtRelative, fmtDate, initials } from "@/lib/format";
import { SearchLoadingBar, motion, AnimatePresence } from "@/components/shared/animations";

const ICONS = {
  quiz_passed: { Icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  quiz_failed: { Icon: X, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400" },
  retake_scheduled: { Icon: Sparkles, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400" },
  module_published: { Icon: Sparkles, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  module_assigned: { Icon: Sparkles, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  user_added: { Icon: Users, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  user_deactivated: { Icon: X, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400" },
  reminder_sent: { Icon: Bell, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  report_exported: { Icon: FileText, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  questions_approved: { Icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  manager_flagged: { Icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  delivery_rescheduled: { Icon: RotateCcw, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400" },
  manager_checked_in: { Icon: UserCheck, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400" },
  session_started: { Icon: Play, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  session_ended: { Icon: Square, bg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
} as const;

export default function AuditLog() {
  const [search, setSearch] = React.useState("");
  const filtered = activity.filter((e) => {
    if (!search) return true;
    return e.message.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Audit log"
        description="Every event in BCJ Learn — who did what, when. Searchable and filterable."
      />

      <div className="mb-4 max-w-md relative">
        <Search className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${search ? "text-primary" : "text-muted-foreground"}`} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events…" className="pl-9 h-9 transition-shadow focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]" />
        <SearchLoadingBar active={!!search} />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            <AnimatePresence initial mode="popLayout">
            {filtered.slice(0, 30).map((e, idx) => {
              const meta = ICONS[e.kind] ?? ICONS.quiz_passed;
              const actor = allUsers.find((u) => u.id === e.actorId);
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.025, 0.4), ease: [0.16, 1, 0.3, 1] }}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-accent/30 transition-colors"
                >
                  <div className={`size-9 rounded-md ${meta.bg} flex items-center justify-center shrink-0`}>
                    <meta.Icon className={`size-4 ${meta.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{e.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{e.kind.replace(/_/g, " ")}</Badge>
                      <span>{fmtDate(e.occurredAt, "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {actor && (
                      <>
                        <Avatar className="size-7 border">
                          <AvatarFallback style={{ background: actor.avatarColor, color: "white" }} className="text-[10px]">
                            {initials(actor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground hidden md:inline">{actor.name}</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{fmtRelative(e.occurredAt)}</span>
                  </div>
                </motion.li>
              );
            })}
            </AnimatePresence>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-muted-foreground text-center">
        Showing {Math.min(filtered.length, 30)} of {filtered.length} matching events ({activity.length} total)
      </div>
    </>
  );
}
