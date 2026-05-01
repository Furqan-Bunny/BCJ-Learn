"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Sparkles, Calendar, FileText, PlayCircle, Layers, Clock, Link2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { modules, moduleContentCounts, moduleTotalMinutes } from "@/data/modules";
import { managers } from "@/data/users";
import { attemptsForManager } from "@/data/attempts";
import { fmtDate } from "@/lib/format";
import { Search } from "lucide-react";
import { Stagger, StaggerItem, SearchLoadingBar, AnimatePresence, motion } from "@/components/shared/animations";

export default function ManagerModules() {
  const me = managers[0];
  const myAttempts = attemptsForManager(me.id);
  const passedSlugs = new Set(myAttempts.filter((a) => a.status === "passed").map((a) => a.moduleSlug));
  const ordered = [...modules].sort((a, b) => a.number - b.number);
  const nextModule = ordered.find((m) => !passedSlugs.has(m.slug));

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const filtered = ordered.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    if (!query) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => setSearching(false), 320);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title="The 5-module program"
        description="One module per month, June through October 2026. Pass each to unlock the next."
      />

      <div className="mb-6 flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className={`size-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searching ? "text-primary" : "text-muted-foreground"}`} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules…" className="pl-9 h-10 transition-shadow focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]" />
          <SearchLoadingBar active={searching} />
        </div>
      </div>

      <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((m) => {
          const passed = passedSlugs.has(m.slug);
          const isNext = nextModule?.slug === m.slug;
          const locked = !passed && !isNext;
          const myAttempt = myAttempts.find((a) => a.moduleSlug === m.slug && a.status === "passed");

          return (
            <StaggerItem key={m.slug}>
            <Card className={`overflow-hidden card-lift ${locked ? "opacity-60" : ""}`}>
              <CardContent className="p-0">
                <div className="grid grid-cols-[auto_1fr] gap-0">
                  <div className="bg-primary/5 border-r flex flex-col items-center justify-center p-6 min-w-[100px]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Module</div>
                    <div className="text-4xl font-bold tracking-tight text-primary mt-1 tabular-nums">{m.number}</div>
                    {passed && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.2 }}><CheckCircle2 className="size-5 text-emerald-500 mt-2" /></motion.span>}
                    {isNext && !passed && <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}><Sparkles className="size-5 text-[var(--gold)] mt-2" /></motion.span>}
                    {locked && <Lock className="size-4 text-muted-foreground mt-2" />}
                  </div>
                  <div className="p-5">
                    <div className="font-semibold text-lg tracking-tight">{m.title}</div>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{m.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {fmtDate(m.scheduledDate)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {moduleTotalMinutes(m.slug)} min · {m.lessons.length} lessons</span>
                      <span className="flex items-center gap-1.5"><PlayCircle className="size-3.5" /> {moduleContentCounts(m.slug).videos} videos</span>
                      <span className="flex items-center gap-1.5"><FileText className="size-3.5" /> {moduleContentCounts(m.slug).documents} docs</span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        {passed && myAttempt && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Passed at {myAttempt.scorePct}%
                          </span>
                        )}
                        {isNext && !passed && <span className="text-primary font-medium">Available now</span>}
                        {locked && <span className="text-muted-foreground">Pass M{m.number - 1} first</span>}
                      </div>
                      <Button asChild variant={passed ? "outline" : "default"} size="sm" disabled={locked}>
                        <Link href={`/manager/modules/${m.slug}`}>
                          {passed ? "Review" : isNext ? "Open" : "Locked"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

      <AnimatePresence>
        {filtered.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 text-muted-foreground"
          >
            No modules match &ldquo;{query}&rdquo;.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
