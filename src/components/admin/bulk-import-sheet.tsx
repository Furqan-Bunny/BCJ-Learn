"use client";

import * as React from "react";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, X, AlertCircle, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bulkInviteUsers } from "@/lib/server/admin-actions";
import { useRouter } from "next/navigation";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface ParsedRow {
  name: string;
  email: string;
  cohort: string;
  ok: boolean;
  error?: string;
}

const VALID_COHORTS = new Set(["Atlanta", "Dallas", "Phoenix"]);

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Skip header if present
  const first = lines[0].toLowerCase();
  const dataLines = first.includes("name") && first.includes("email") ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [name = "", email = "", cohort = ""] = cells;
    let ok = true;
    let error: string | undefined;
    if (!name) { ok = false; error = "Missing name"; }
    else if (!email || !email.includes("@")) { ok = false; error = "Invalid email"; }
    else if (!VALID_COHORTS.has(cohort)) { ok = false; error = `Cohort must be one of ${Array.from(VALID_COHORTS).join(", ")}`; }
    return { name, email, cohort, ok, error };
  });
}

const SAMPLE_CSV = `name,email,cohort
Jordan Patel,jordan@bcj.com,Atlanta
Maya Chen,maya@bcj.com,Dallas
Sam Carter,sam@bcj.com,Phoenix`;

export function BulkImportSheet() {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validCount = rows.filter((r) => r.ok).length;
  const invalidCount = rows.length - validCount;

  React.useEffect(() => {
    if (open) {
      setRows([]);
      setFileName(null);
    }
  }, [open]);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRows(parseCsv(text));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bcj-managers-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const router = useRouter();

  async function handleSubmit() {
    if (validCount === 0) return;
    setSubmitting(true);

    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 600));
      setSubmitting(false);
      setOpen(false);
      toast.success(`Imported ${validCount} employee${validCount === 1 ? "" : "s"} (demo)`, {
        description: "Demo mode — no real invites sent.",
      });
      return;
    }

    const validRows = rows.filter((r) => r.ok).map((r) => ({
      name: r.name,
      email: r.email.toLowerCase(),
      cohort: r.cohort,
    }));

    const result = await bulkInviteUsers(validRows);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error ?? "Bulk import failed");
      return;
    }

    const failed = (result.results ?? []).filter((r) => !r.ok).length;
    setOpen(false);
    toast.success(`Invited ${result.invited} employee${result.invited === 1 ? "" : "s"}`, {
      description: failed > 0
        ? `${failed} row${failed === 1 ? "" : "s"} failed (usually duplicate emails). Each new employee gets an invitation email.`
        : "Each new employee gets an invitation email with a 7-day link to set up their account.",
    });
    router.refresh();
    return;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 size-4" /> Bulk import
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-2">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
            CSV bulk import
          </Badge>
          <SheetTitle className="text-xl tracking-tight">Import employees from CSV</SheetTitle>
          <SheetDescription>
            Upload a CSV with three columns: <span className="font-mono">name</span>, <span className="font-mono">email</span>, <span className="font-mono">cohort</span>. Each valid row creates a new Employee and queues a welcome email.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Dropzone */}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/30",
            )}
          >
            <div className="size-10 mx-auto rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="text-sm font-medium">
              {fileName ? fileName : "Drop your CSV file here, or click to browse"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Format: name, email, cohort (Atlanta · Dallas · Phoenix)
            </div>
          </div>

          {/* Sample download */}
          <div className="flex items-center justify-between text-xs">
            <button onClick={downloadSample} className="text-primary hover:underline flex items-center gap-1.5">
              <Download className="size-3" /> Download sample CSV
            </button>
            {rows.length > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{validCount} valid</span>
                {invalidCount > 0 && (
                  <>
                    <span className="mx-1">·</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{invalidCount} with errors</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Parsed preview */}
          {rows.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Preview
              </div>
              <ul className="max-h-72 overflow-y-auto divide-y">
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className={cn(
                      "px-3 py-2 flex items-center gap-3 text-sm",
                      !r.ok && "bg-rose-50 dark:bg-rose-950/20",
                    )}
                  >
                    <Badge
                      variant={r.ok ? "secondary" : "destructive"}
                      className="font-mono text-[10px] shrink-0"
                    >
                      {r.ok ? "OK" : "Error"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name || <span className="italic text-muted-foreground">(no name)</span>}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.email} · {r.cohort || "—"}</div>
                      {r.error && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{r.error}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {invalidCount > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/15 p-3 flex items-start gap-2 text-xs">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">{invalidCount} row{invalidCount === 1 ? "" : "s"}</span> will be skipped.
                Fix the issues in your CSV and re-upload, or proceed with the {validCount} valid rows.
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--ai)]/30 bg-[var(--ai)]/5 p-3 flex items-start gap-2 text-xs">
            <Sparkles className="size-3.5 text-[var(--ai)] shrink-0 mt-0.5" />
            <div className="text-muted-foreground">
              Each imported manager is auto-assigned the 5-module program and queued for invitation emails on the next delivery of each module.
            </div>
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button onClick={handleSubmit} disabled={validCount === 0 || submitting}>
            {submitting ? "Importing…" : `Import ${validCount} manager${validCount === 1 ? "" : "s"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
