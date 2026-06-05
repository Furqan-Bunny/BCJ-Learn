"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, CheckCircle2, Sparkles, RotateCcw, Folder, FolderOpen, ChevronDown } from "lucide-react";
import { fmtRelative } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import { acknowledgeResource } from "@/lib/server/resource-actions";
import { ResourceDocViewer } from "@/components/resources/resource-doc-viewer";
import type { Resource } from "@/lib/db/resources";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";

type ResourceWithAck = Resource & { ackStatus: "new" | "acknowledged" | "updated" };

export function ResourcesEmployeeView({ initialResources }: { initialResources: ResourceWithAck[] }) {
  const router = useRouter();
  const t = useT();
  const [viewing, setViewing] = React.useState<ResourceWithAck | null>(null);
  const [acking, setAcking] = React.useState(false);

  // Grouped into department "folders".
  const byCategory = new Map<string, ResourceWithAck[]>();
  for (const r of initialResources) {
    const dept = r.department || "General";
    const list = byCategory.get(dept) ?? [];
    list.push(r);
    byCategory.set(dept, list);
  }
  const departmentNames = Array.from(byCategory.keys());

  // Collapsible folders. Default-open any folder that has an item still needing
  // acknowledgement (so nothing required gets missed); else open the first.
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setOpenFolders((prev) => {
      if (prev.size) return prev;
      const needs = departmentNames.filter((d) =>
        (byCategory.get(d) ?? []).some((r) => r.requiresAck && r.ackStatus !== "acknowledged"),
      );
      return new Set(needs.length ? needs : departmentNames.slice(0, 1));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentNames.join("|")]);
  function toggleFolder(d: string) {
    setOpenFolders((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
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
          <div className="font-medium">{t("resources.empty")}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {t("resources.emptyDesc")}
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
            <span className="font-semibold">{t("resources.needAttention", { n: needsAck })}</span>{" "}
            <span className="text-muted-foreground">{t("resources.reviewEach")}</span>
          </div>
        </div>
      )}

      {Array.from(byCategory.entries()).map(([cat, list]) => {
        const open = openFolders.has(cat);
        const pendingCount = list.filter((r) => r.requiresAck && r.ackStatus !== "acknowledged").length;
        return (
        <div key={cat} className="mb-3 rounded-lg border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleFolder(cat)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
          >
            <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {open ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{cat}</div>
              <div className="text-[11px] text-muted-foreground">{t("resources.itemCount", { n: list.length })}</div>
            </div>
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px]">
                {t("resources.toReview", { n: pendingCount })}
              </Badge>
            )}
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
          <Stagger className="grid lg:grid-cols-2 gap-3 p-3 border-t bg-muted/20">
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
                                <CheckCircle2 className="size-2.5" /> {t("resources.acknowledged")}
                              </Badge>
                            ) : r.ackStatus === "updated" ? (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20 gap-1 shrink-0 text-[10px]">
                                <RotateCcw className="size-2.5" /> {t("resources.updated")}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20 gap-1 shrink-0 text-[10px]">
                                <Sparkles className="size-2.5" /> {t("resources.new")}
                              </Badge>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-2">
                            {t("resources.updatedAt", { when: fmtRelative(r.updatedAt) })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
          )}
        </div>
        );
      })}

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
                  ? t("resources.alreadyAcked")
                  : viewing.ackStatus === "updated"
                    ? t("resources.reConfirm")
                    : t("resources.confirmRead")}
              </div>
              <Button onClick={handleAcknowledge} disabled={acking || viewing.ackStatus === "acknowledged"}>
                {viewing.ackStatus === "acknowledged"
                  ? <><CheckCircle2 className="size-4 mr-1.5" /> {t("resources.acknowledged")}</>
                  : acking
                    ? t("resources.savingBtn")
                    : t("resources.readUnderstood")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

