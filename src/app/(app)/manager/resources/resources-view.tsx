"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Folder, FolderOpen, ChevronDown } from "lucide-react";
import { fmtRelative } from "@/lib/format";
import { Stagger, StaggerItem } from "@/components/shared/animations";
import { ResourceDocViewer } from "@/components/resources/resource-doc-viewer";
import type { Resource } from "@/lib/db/resources";
import { useT } from "@/lib/i18n/provider";

// The employee resources hub is a clean document library — open a card to read it.
// (The per-resource "I have read and understood" acknowledgement was removed.)
type ResourceWithAck = Resource & { ackStatus: "new" | "acknowledged" | "updated" };

export function ResourcesEmployeeView({ initialResources }: { initialResources: ResourceWithAck[] }) {
  const t = useT();
  const [viewing, setViewing] = React.useState<ResourceWithAck | null>(null);

  // Grouped into department "folders".
  const byCategory = new Map<string, ResourceWithAck[]>();
  for (const r of initialResources) {
    const dept = r.department || "General";
    const list = byCategory.get(dept) ?? [];
    list.push(r);
    byCategory.set(dept, list);
  }
  const departmentNames = Array.from(byCategory.keys());

  // Collapsible folders — default-open the first so something shows.
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    setOpenFolders((prev) => (prev.size ? prev : new Set(departmentNames.slice(0, 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentNames.join("|")]);
  function toggleFolder(d: string) {
    setOpenFolders((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d); else n.add(d);
      return n;
    });
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

  return (
    <>
      {Array.from(byCategory.entries()).map(([cat, list]) => {
        const open = openFolders.has(cat);
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
                  <Card className="card-lift h-full">
                    <CardContent className="p-4 h-full">
                      <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{r.title}</div>
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
        <DialogContent className="sm:max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
