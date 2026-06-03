"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, CheckCircle2, Sparkles, RotateCcw, Loader2, Download, ExternalLink } from "lucide-react";
import { fmtRelative } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import { acknowledgeResource } from "@/lib/server/resource-actions";
import { signedUrlForContent } from "@/lib/supabase/storage";
import type { Resource } from "@/lib/db/resources";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ResourceWithAck = Resource & { ackStatus: "new" | "acknowledged" | "updated" };

export function ResourcesEmployeeView({ initialResources }: { initialResources: ResourceWithAck[] }) {
  const router = useRouter();
  const [viewing, setViewing] = React.useState<ResourceWithAck | null>(null);
  const [acking, setAcking] = React.useState(false);

  const byCategory = new Map<string, ResourceWithAck[]>();
  for (const r of initialResources) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  async function handleAcknowledge() {
    if (!viewing) return;
    setAcking(true);
    const result = await acknowledgeResource(viewing.id);
    setAcking(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not acknowledge");
      return;
    }
    toast.success(`Acknowledged: ${viewing.title}`);
    setViewing(null);
    router.refresh();
  }

  if (initialResources.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FileText className="size-10 mx-auto opacity-30 mb-3" />
          <div className="font-medium">No resources assigned yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Check back later — your team will share SOPs and policies here.
          </div>
        </CardContent>
      </Card>
    );
  }

  const needsAck = initialResources.filter((r) => r.requiresAck && r.ackStatus !== "acknowledged").length;

  return (
    <>
      {needsAck > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <Sparkles className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">{needsAck} resource{needsAck === 1 ? "" : "s"} need your attention.</span>{" "}
            <span className="text-muted-foreground">Review each and click &ldquo;I have read and understood.&rdquo;</span>
          </div>
        </div>
      )}

      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="mb-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h3>
          <Stagger className="grid lg:grid-cols-2 gap-3">
            {list.map((r) => (
              <StaggerItem key={r.id} className="h-full">
                <button
                  onClick={() => setViewing(r)}
                  className="w-full text-left h-full"
                >
                  <Card className={`card-lift h-full ${r.ackStatus === "new" ? "border-amber-500/40" : r.ackStatus === "updated" ? "border-rose-500/40" : ""}`}>
                    <CardContent className="p-4 h-full">
                      <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold truncate">{r.title}</div>
                            {r.ackStatus === "acknowledged" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 gap-1 shrink-0 text-[10px]">
                                <CheckCircle2 className="size-2.5" /> Acknowledged
                              </Badge>
                            ) : r.ackStatus === "updated" ? (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20 gap-1 shrink-0 text-[10px]">
                                <RotateCcw className="size-2.5" /> Updated
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20 gap-1 shrink-0 text-[10px]">
                                <Sparkles className="size-2.5" /> New
                              </Badge>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-2">
                            Updated {fmtRelative(r.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}

      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
              {viewing?.category}
            </Badge>
            <DialogTitle>{viewing?.title}</DialogTitle>
            {viewing?.description && (
              <DialogDescription>{viewing.description}</DialogDescription>
            )}
          </DialogHeader>

          {viewing && <ResourceDocViewer resource={viewing} />}

          {viewing?.requiresAck && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t mt-2">
              <div className="text-xs text-muted-foreground">
                {viewing.ackStatus === "acknowledged"
                  ? "You already acknowledged this version."
                  : viewing.ackStatus === "updated"
                    ? "This was updated since you last acknowledged. Please re-confirm."
                    : "Click to confirm you've read and understood."}
              </div>
              <Button onClick={handleAcknowledge} disabled={acking || viewing.ackStatus === "acknowledged"}>
                {viewing.ackStatus === "acknowledged"
                  ? <><CheckCircle2 className="size-4 mr-1.5" /> Acknowledged</>
                  : acking
                    ? "Saving…"
                    : "I have read and understood"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Renders an SOP/resource: inline markdown body, stored file (PDF/video/other), or external link. */
function ResourceDocViewer({ resource }: { resource: Resource }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    if (!resource.storagePath) return;
    signedUrlForContent(resource.storagePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [resource.storagePath]);

  // 1) Stored file (PDF / video / other) takes priority.
  if (resource.storagePath) {
    const ext = resource.storagePath.toLowerCase().split(".").pop() ?? "";
    const isPdf = ext === "pdf";
    const isVideo = ext === "mp4" || ext === "webm" || ext === "mov";

    if (error) {
      return (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
          Could not load this document. {error}
        </div>
      );
    }
    if (!url) {
      return (
        <div className="rounded-lg border bg-muted/30 p-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Preparing document…
        </div>
      );
    }
    if (isPdf) {
      return <iframe src={url} loading="lazy" className="w-full h-[60vh] rounded-lg border bg-white" title={resource.title} />;
    }
    if (isVideo) {
      return <video src={url} controls className="w-full rounded-lg border bg-black" />;
    }
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center">
        <FileText className="size-10 mx-auto opacity-40 mb-3" />
        <div className="text-sm text-muted-foreground mb-4">Preview isn&rsquo;t available for this file type.</div>
        <Button asChild>
          <a href={url} download target="_blank" rel="noreferrer">
            <Download className="size-4 mr-1.5" /> Download to view
          </a>
        </Button>
      </div>
    );
  }

  // 2) Inline markdown body.
  if (resource.body) {
    const lines = resource.body.split("\n").filter(Boolean);
    return (
      <div className="rounded-lg border p-5 max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mb-3">{line.slice(2)}</h2>;
          if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
          return <p key={i} className="leading-relaxed mb-2 text-foreground/90">{line}</p>;
        })}
      </div>
    );
  }

  // 3) External link.
  if (resource.externalUrl) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-center">
        <ExternalLink className="size-8 mx-auto opacity-40 mb-2 text-muted-foreground" />
        <p className="text-muted-foreground mb-3">This SOP lives on an external page.</p>
        <Button asChild variant="outline">
          <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4 mr-1.5" /> Open document
          </a>
        </Button>
      </div>
    );
  }

  // 4) Notice-only.
  return (
    <div className="rounded-lg border p-4 text-sm text-muted-foreground italic">
      No document attached. Acknowledge to confirm you&rsquo;ve seen this notice.
    </div>
  );
}
