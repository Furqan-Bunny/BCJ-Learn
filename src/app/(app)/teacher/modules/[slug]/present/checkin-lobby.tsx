"use client";

// Phase 1 of the presenter: the check-in lobby. The trainer opens check-in
// (only once the scheduled start time has arrived, checked against their own
// device clock = venue local time). Opening mints a short code shown big on the
// projector; employees enter it on their devices to check in. The roster fills
// in live. When ready, the trainer starts the presentation.

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Lock, Users, CheckCircle2, Loader2, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ModuleDef, CheckinState } from "@/types";
import { openCheckIn, regenerateCheckinCode, getCheckinState } from "@/lib/server/module-actions";
import { fmtDate } from "@/lib/format";

function scheduledStart(mod: ModuleDef): Date | null {
  if (!mod.scheduledDate) return null;
  const [y, m, d] = mod.scheduledDate.split("-").map(Number);
  const [hh, mm] = (mod.scheduledTime || "00:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0);
}

function fmtTime12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export function CheckinLobby({ mod, onStart }: { mod: ModuleDef; onStart: () => void }) {
  const slug = mod.slug;
  const [state, setState] = React.useState<CheckinState | null>(null);
  const [opening, setOpening] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      const s = await getCheckinState(slug);
      if (alive) setState(s);
    }
    void load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [slug]);

  const start = scheduledStart(mod);
  const canOpen = !start || now.getTime() >= start.getTime();
  const open = state?.open ?? false;
  const code = state?.code ?? null;
  const checkedIn = state?.checkedIn ?? [];
  const invited = state?.invited ?? 0;

  async function handleOpen() {
    setOpening(true);
    const res = await openCheckIn(slug);
    setOpening(false);
    if (!res.ok) { toast.error(res.error ?? "Could not open check-in"); return; }
    setState(await getCheckinState(slug));
    toast.success("Check-in is open", { description: "Managers can now check in with the code on screen." });
  }

  async function handleNewCode() {
    setRegenerating(true);
    const res = await regenerateCheckinCode(slug);
    setRegenerating(false);
    if (!res.ok) { toast.error(res.error ?? "Could not generate a new code"); return; }
    setState(await getCheckinState(slug));
    toast.success("New code generated", { description: "Share the new code shown on screen." });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-50 flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-white/10 bg-slate-950/80">
        <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
          <Link href={`/teacher/modules/${slug}`}><ArrowLeft className="size-4 mr-1" /> Exit</Link>
        </Button>
        <Badge className="bg-[var(--gold)] text-slate-900 border-transparent uppercase tracking-wider text-[10px]">Check-in</Badge>
        <span className="text-sm font-medium">{mod.title}</span>
        <span className="text-xs text-slate-400">— Module {mod.number}</span>
        <div className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {mod.scheduledDate ? fmtDate(mod.scheduledDate) : "—"}{mod.scheduledTime ? ` · ${fmtTime12(mod.scheduledTime)}` : ""}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        {!open ? (
          // ─── Check-in not opened yet ───────────────────────────────
          <div className="max-w-md text-center space-y-6">
            <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
              <Lock className="size-8 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Check-in is closed</h1>
              <p className="text-sm text-slate-400 mt-2">
                {canOpen
                  ? "Open check-in when you're ready. Managers will enter a code shown here to confirm they're in the room."
                  : `Check-in opens at the scheduled start time${mod.scheduledTime ? ` — ${fmtTime12(mod.scheduledTime)}` : ""}. Nobody can check in before then.`}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleOpen}
              disabled={!canOpen || opening}
              className="h-12 px-8 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-slate-900"
            >
              {opening ? <Loader2 className="size-5 mr-2 animate-spin" /> : null}
              {canOpen ? "Open check-in" : `Opens at ${mod.scheduledTime ? fmtTime12(mod.scheduledTime) : "start time"}`}
            </Button>
          </div>
        ) : (
          // ─── Check-in open: code + live roster ─────────────────────
          <div className="w-full max-w-3xl grid md:grid-cols-[280px_1fr] gap-6 items-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Enter this code to check in</div>
              <div className="mt-3 text-6xl font-bold font-mono tracking-[0.2em] text-[var(--gold)]">{code ?? "····"}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewCode}
                disabled={regenerating}
                className="mt-3 text-slate-300 hover:text-white hover:bg-white/10"
              >
                {regenerating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1.5" />}
                New code
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                Managers open <span className="text-slate-200">{mod.title}</span> on their device and enter this code. Only people in the room can check in.
              </p>
              <p className="text-[11px] text-slate-500 mt-3 border-t border-white/10 pt-3">
                This code is for <span className="text-slate-300">check-in</span> only. The quiz opens to the room automatically when you end the session.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="size-4 text-slate-400" />
                  Checked in
                  <span className="text-[var(--gold)] font-bold tabular-nums">{checkedIn.length}</span>
                  <span className="text-slate-500">of {invited}</span>
                </div>
                <Loader2 className="size-3.5 animate-spin text-slate-600" />
              </div>
              <div className="rounded-xl border border-white/10 min-h-[180px] max-h-[46vh] overflow-y-auto p-2">
                {checkedIn.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-12 text-sm text-slate-500">
                    Waiting for managers to check in…
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {checkedIn.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                        <span className="text-sm truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button size="lg" onClick={onStart} className="h-12 px-8">
                  Start presentation <ArrowRight className="size-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
