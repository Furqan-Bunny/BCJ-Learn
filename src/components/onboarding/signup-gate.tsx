"use client";

// Full-screen blocking gate shown when the signed-in user still has sign-up /
// onboarding resources to acknowledge (resources flagged signup_ack). They
// can't reach any (app) page until each one is read & acknowledged. Rendered by
// the authenticated layout in place of the normal shell.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, LogOut, Loader2, ArrowRight } from "lucide-react";
import { ResourceDocViewer } from "@/components/resources/resource-doc-viewer";
import { acknowledgeResource } from "@/lib/server/resource-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Resource } from "@/lib/db/resources";

interface Props {
  resources: Resource[];
  userName: string;
  logoUrl: string | null;
}

export function SignupGate({ resources, userName, logoUrl }: Props) {
  const router = useRouter();
  const [signed, setSigned] = React.useState<Set<string>>(new Set());
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [continuing, setContinuing] = React.useState(false);

  const allSigned = resources.length > 0 && resources.every((r) => signed.has(r.id));
  const firstName = userName?.split(" ")[0] || "there";

  async function ack(id: string) {
    setBusyId(id);
    const res = await acknowledgeResource(id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Could not acknowledge — please try again.");
      return;
    }
    setSigned((prev) => new Set(prev).add(id));
  }

  function continueIn() {
    setContinuing(true);
    // The layout re-checks outstanding acks on refresh; once all are signed the
    // normal app shell renders.
    router.refresh();
  }

  async function signOut() {
    try {
      const sb = createClient();
      await sb.auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 md:px-8 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
          ) : (
            <div className="flex items-center justify-center size-8 rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
          )}
          <span className="font-semibold tracking-tight">BCJ Learn</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="size-3.5 mr-1.5" /> Sign out
        </Button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center gap-2 text-primary mb-2">
          <ShieldCheck className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Before you continue</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">A few things to review, {firstName}</h1>
        <p className="text-muted-foreground mt-2">
          Please read and acknowledge {resources.length === 1 ? "this document" : "these documents"} to finish setting up your access.
        </p>

        <div className="mt-6 space-y-5">
          {resources.map((r) => {
            const isSigned = signed.has(r.id);
            return (
              <section key={r.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.title}</div>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>}
                  </div>
                  {isSigned && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" /> Acknowledged
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <ResourceDocViewer resource={r} />
                  {!isSigned && (
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => ack(r.id)} disabled={busyId === r.id}>
                        {busyId === r.id
                          ? <><Loader2 className="size-4 mr-1.5 animate-spin" /> Saving…</>
                          : <><CheckCircle2 className="size-4 mr-1.5" /> I have read &amp; understood</>}
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <footer className="sticky bottom-0 border-t bg-background/80 px-4 md:px-8 py-3 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {allSigned
              ? "All set — you can continue."
              : `${signed.size} of ${resources.length} acknowledged`}
          </span>
          <Button onClick={continueIn} disabled={!allSigned || continuing}>
            {continuing
              ? <><Loader2 className="size-4 mr-1.5 animate-spin" /> Continuing…</>
              : <>Continue <ArrowRight className="size-4 ml-1.5" /></>}
          </Button>
        </div>
      </footer>
    </div>
  );
}
