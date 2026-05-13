"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Calendar, Users, BookOpen, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import {
  exportCohortSummaryCsv,
  exportResultsCsv,
  exportAtRiskCsv,
  exportAttemptLogCsv,
} from "@/lib/server/export-actions";
import { downloadCsv } from "@/lib/utils/download-csv";

interface ReportSpec {
  key: "cohort" | "module" | "at-risk" | "attempt-log";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const REPORTS: ReportSpec[] = [
  {
    key: "cohort",
    title: "Cohort summary",
    icon: Users,
    description: "Pass rates, average scores, and at-risk counts across all three cohorts. Best for QBR prep.",
  },
  {
    key: "module",
    title: "Module summary",
    icon: BookOpen,
    description: "Per-module attempts, pass rate, score distribution, and most-missed questions. One per module.",
  },
  {
    key: "at-risk",
    title: "At-risk register",
    icon: AlertTriangle,
    description: "All currently at-risk employees with reasons and last activity. Send straight to HR.",
  },
  {
    key: "attempt-log",
    title: "Full attempt log",
    icon: FileText,
    description: "Every quiz attempt across the program. Best as a CSV for spreadsheet analysis.",
  },
];

export default function AdminReports() {
  const [from, setFrom] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  });
  const [busy, setBusy] = React.useState<string | null>(null);

  async function generate(spec: ReportSpec) {
    setBusy(spec.key);
    try {
      let result: { ok: boolean; csv?: string; error?: string };
      let filename: string;
      const stamp = new Date().toISOString().slice(0, 10);
      switch (spec.key) {
        case "cohort":
          result = await exportCohortSummaryCsv();
          filename = `bcj-cohort-summary-${stamp}.csv`;
          break;
        case "module":
          result = await exportResultsCsv({ from, to });
          filename = `bcj-module-summary-${stamp}.csv`;
          break;
        case "at-risk":
          result = await exportAtRiskCsv();
          filename = `bcj-at-risk-${stamp}.csv`;
          break;
        case "attempt-log":
          result = await exportAttemptLogCsv(from, to);
          filename = `bcj-attempt-log-${stamp}.csv`;
          break;
      }
      if (!result.ok || !result.csv) {
        toast.error(result.error ?? "Could not generate report");
        return;
      }
      downloadCsv(result.csv, filename);
      toast.success(`${spec.title} downloaded as CSV`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports & exports"
        description="Pre-built reports that BCJ leadership can hand to HR, Regional, or download for QBRs. CSV format; PDF coming in v1.1."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" /> Date range
            <span className="text-[11px] text-muted-foreground font-normal">(applies to Module summary + Attempt log)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 items-stretch">
        {REPORTS.map((r) => (
          <Card key={r.key} className="h-full">
            <CardContent className="p-5 h-full">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <r.icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" onClick={() => generate(r)} disabled={busy === r.key}>
                      {busy === r.key ? (
                        <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Generating…</>
                      ) : (
                        <><Download className="size-3.5 mr-1.5" /> Download CSV</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
