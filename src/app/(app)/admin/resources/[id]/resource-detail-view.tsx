"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Pencil, Trash2, FileText, History, Users, CheckCircle2, Circle, Clock, ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, pageSlice } from "@/components/ui/pagination";
import { ResourceDocViewer } from "@/components/resources/resource-doc-viewer";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteResource } from "@/lib/server/resource-actions";
import type { Resource, ResourceVersion, ResourceVersionSnapshot, AckHistoryEntry, AckStatusRow } from "@/lib/db/resources";

const ROLE_LABEL: Record<string, string> = { manager: "Employees", teacher: "Department Leads", admin: "Admins" };

// Human label for each snapshot field, in display order.
const DIFF_FIELDS: { key: keyof ResourceVersionSnapshot; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "department", label: "Department" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "body", label: "Body" },
  { key: "storagePath", label: "File" },
  { key: "externalUrl", label: "Link" },
  { key: "requiresAck", label: "Acknowledgement toggle" },
  { key: "assignedRoles", label: "Audience" },
  { key: "assignedCohorts", label: "Markets" },
];

function diffSnapshots(curr: ResourceVersionSnapshot, prev: ResourceVersionSnapshot): string[] {
  const changed: string[] = [];
  for (const f of DIFF_FIELDS) {
    if (JSON.stringify(curr[f.key] ?? null) !== JSON.stringify(prev[f.key] ?? null)) changed.push(f.label);
  }
  return changed;
}

export function ResourceDetailView({
  resource,
  versions,
  ackHistory,
  ackStatus,
}: {
  resource: Resource;
  versions: ResourceVersion[];
  ackHistory: AckHistoryEntry[];
  ackStatus: AckStatusRow[];
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const acked = ackStatus.filter((u) => u.acked);
  const pending = ackStatus.filter((u) => !u.acked);
  const orderedAck = React.useMemo(() => [...acked, ...pending], [acked, pending]);
  const ACK_PER_PAGE = 15;
  const [ackPage, setAckPage] = React.useState(0);

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteResource(resource.id);
    setDeleting(false);
    if (!res.ok) { toast.error(res.error ?? "Could not delete"); return; }
    toast.success("Resource deleted");
    router.push("/admin/resources");
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/admin/resources"><ArrowLeft className="size-4 mr-1" /> All resources</Link>
      </Button>

      <PageHeader
        eyebrow={resource.department || "Resource"}
        title={resource.title}
        description={resource.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/resources?edit=${resource.id}`}><Pencil className="size-4 mr-1.5" /> Edit</Link>
            </Button>
            <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4 mr-1.5" /> Delete
            </Button>
          </div>
        }
      />

      {/* Key metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetaCard icon={FileText} label="Category" value={resource.category} />
        <MetaCard icon={Users} label="Audience" value={resource.assignedRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ") || "—"} />
        <MetaCard icon={History} label="Current version" value={`v${resource.version}`} />
        <MetaCard
          icon={ShieldCheck}
          label="Acknowledgement"
          value={resource.requiresAck ? `${acked.length} of ${ackStatus.length}` : "Not required"}
        />
      </div>

      <Tabs defaultValue="preview">
        <TabsList variant="line" className="mb-5">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
          <TabsTrigger value="acks">Acknowledgements</TabsTrigger>
        </TabsList>

        {/* ── Preview ── */}
        <TabsContent value="preview">
          <ResourceDocViewer resource={resource} />
        </TabsContent>

        {/* ── Change history (audit) ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><History className="size-4 text-muted-foreground" /> Change history</CardTitle>
              <p className="text-xs text-muted-foreground">Every edit to this resource — what changed, when, and who.</p>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No history recorded yet.</div>
              ) : (
                <ol className="relative border-l-2 border-border ml-2 space-y-5">
                  {versions.map((v, i) => {
                    const prev = versions[i + 1]; // older
                    const changed = prev ? diffSnapshots(v.snapshot, prev.snapshot) : [];
                    const isCreated = v.changeReason === "created" || !prev;
                    return (
                      <li key={v.seq} className="ml-5">
                        <span className="absolute -left-[9px] mt-1 size-4 rounded-full border-2 border-background bg-primary" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px]">v{v.seq}</Badge>
                          <span className="text-sm font-medium">{isCreated ? "Created" : "Edited"}</span>
                          {v.changedByName && <span className="text-xs text-muted-foreground">by {v.changedByName}</span>}
                          <span className="text-xs text-muted-foreground">· {fmtDate(v.createdAt, "MMM d, yyyy · h:mm a")}</span>
                          <Badge variant="secondary" className="text-[10px]">ack v{v.ackVersion}</Badge>
                        </div>
                        {!isCreated && (
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {changed.length > 0
                              ? <>Changed: <span className="text-foreground font-medium">{changed.join(", ")}</span></>
                              : "No field changes recorded"}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Acknowledgements (tree) ── */}
        <TabsContent value="acks">
          {!resource.requiresAck ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              This resource doesn&rsquo;t require acknowledgement.
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {/* Current-version status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground" /> Current version (v{resource.version})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{acked.length}</span> of {ackStatus.length} have acknowledged the latest version.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border divide-y">
                    {ackStatus.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No one is assigned this resource.</div>
                    ) : (
                      pageSlice(orderedAck, ackPage, ACK_PER_PAGE).map((u) => (
                        <div key={u.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                          {u.acked
                            ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                            : <Circle className="size-4 text-muted-foreground/40 shrink-0" />}
                          <span className="flex-1 min-w-0 truncate font-medium">{u.name}</span>
                          <span className={cn("text-[11px] shrink-0", u.acked ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                            {u.acked
                              ? (u.acknowledgedAt ? fmtDate(u.acknowledgedAt, "MMM d · h:mm a") : "Acknowledged")
                              : "Pending"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Pagination page={ackPage} total={orderedAck.length} pageSize={ACK_PER_PAGE} onPageChange={setAckPage} className="mt-3" />
                </CardContent>
              </Card>

              {/* Per-version acknowledgement tree */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><History className="size-4 text-muted-foreground" /> Acknowledgement history</CardTitle>
                  <p className="text-xs text-muted-foreground">Each version that was acknowledged, with who signed and when. New versions (after a re-acknowledgement edit) branch below.</p>
                </CardHeader>
                <CardContent>
                  {ackHistory.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No acknowledgements recorded yet.</div>
                  ) : (
                    <div className="space-y-5">
                      {ackHistory.map((entry) => <AckVersionNode key={entry.version} entry={entry} />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              &ldquo;{resource.title}&rdquo; will be permanently removed and unlinked from any modules. Past acknowledgements are kept for the record. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AckVersionNode({ entry }: { entry: AckHistoryEntry }) {
  const PER = 10;
  const [page, setPage] = React.useState(0);
  return (
    <div className="rounded-lg border">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-mono text-[10px]">Version {entry.version}</Badge>
        <span className="text-xs text-muted-foreground">
          {entry.requiredAt
            ? <>required after {entry.requiredByName ?? "an edit"} · {fmtDate(entry.requiredAt, "MMM d, yyyy")}</>
            : "initial version"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">{entry.acks.length} acknowledged</span>
      </div>
      <ul className="divide-y">
        {pageSlice(entry.acks, page, PER).map((a, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate font-medium">{a.name}</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Clock className="size-3" /> {fmtDate(a.acknowledgedAt, "MMM d, yyyy · h:mm a")}
            </span>
          </li>
        ))}
      </ul>
      {entry.acks.length > PER && (
        <div className="px-3 py-2 border-t">
          <Pagination page={page} total={entry.acks.length} pageSize={PER} onPageChange={setPage} hideSummary />
        </div>
      )}
    </div>
  );
}

function MetaCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-semibold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
