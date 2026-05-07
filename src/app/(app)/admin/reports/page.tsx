"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Calendar, Users, BookOpen, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";

const REPORTS = [
  {
    title: "Cohort summary",
    icon: Users,
    description: "Pass rates, average scores, and at-risk counts across all three cohorts. Best for QBR prep.",
  },
  {
    title: "Module summary",
    icon: BookOpen,
    description: "Per-module attempts, pass rate, score distribution, and most-missed questions. One per module.",
  },
  {
    title: "At-risk register",
    icon: AlertTriangle,
    description: "All currently at-risk employees with reasons and last activity. Send straight to HR.",
  },
  {
    title: "Full attempt log",
    icon: FileText,
    description: "Every quiz attempt across the program. Big file. Best as a CSV for spreadsheet analysis.",
  },
];

export default function AdminReports() {
  const [from, setFrom] = React.useState("2026-01-01");
  const [to, setTo] = React.useState("2026-12-31");

  function generate(name: string, format: "csv" | "pdf") {
    toast.success(`${name} (${format.toUpperCase()}) is downloading…`, {
      description: `Date range: ${from} → ${to}`,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports & exports"
        description="Pre-built reports that BCJ leadership can hand to HR, Regional, or download for QBRs."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" /> Date range
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

      <div className="grid lg:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.title}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <r.icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" onClick={() => generate(r.title, "pdf")}>
                      <Download className="size-3.5 mr-1.5" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generate(r.title, "csv")}>
                      <Download className="size-3.5 mr-1.5" /> CSV
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
