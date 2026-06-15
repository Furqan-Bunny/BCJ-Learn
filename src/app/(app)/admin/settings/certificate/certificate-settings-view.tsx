"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import { updateCertificateSettings } from "@/lib/server/settings-actions";
import type { CertificateSettings } from "@/lib/db/settings";

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function CertificateSettingsView({ initial }: { initial: CertificateSettings }) {
  const router = useRouter();
  const [s, setS] = React.useState<CertificateSettings>(initial);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof CertificateSettings>(key: K, value: CertificateSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateCertificateSettings(s);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Could not save"); return; }
    toast.success("Certificate template saved");
    router.refresh();
  }

  // Live-preview sample values.
  const vars = {
    name: "Sample Manager",
    module: "Module 1: Sample Module",
    score: "92%",
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Completion certificate"
        description="Customise the certificate managers get when they pass a module. Use {{name}}, {{module}}, {{score}}, {{date}} as placeholders."
      />

      <div className="grid lg:grid-cols-[1fr_460px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Wording</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Heading" value={s.heading} onChange={(v) => set("heading", v)} placeholder="Certificate of Completion" />
              <Field label="Intro line (above the name)" value={s.introLine} onChange={(v) => set("introLine", v)} placeholder="This certifies that" />
              <Field label="Completion line (above the module)" value={s.completionLine} onChange={(v) => set("completionLine", v)} placeholder="has successfully completed" />
              <Field label="Footer" value={s.footer} onChange={(v) => set("footer", v)} placeholder="BCJ Learn — Training Platform" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Organisation &amp; signatory</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Organisation name" value={s.orgName} onChange={(v) => set("orgName", v)} placeholder="BCJ Building Services" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Signatory name (optional)" value={s.signatoryName} onChange={(v) => set("signatoryName", v)} placeholder="e.g., Jane Smith" />
                <Field label="Signatory title (optional)" value={s.signatoryTitle} onChange={(v) => set("signatoryTitle", v)} placeholder="Director of Operations" />
              </div>
              <label className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Show logo</div>
                  <div className="text-xs text-muted-foreground">Uses your branding logo (Settings → Branding).</div>
                </div>
                <Switch checked={s.showLogo} onCheckedChange={(v) => set("showLogo", v)} />
              </label>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => router.refresh()}>Discard</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save template"}</Button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <Card className="sticky top-20">
            <CardHeader><CardTitle className="text-base">Live preview</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-white text-[#041D39] rounded-lg overflow-hidden border-4 border-double border-[#041D39] p-6 text-center text-sm">
                <div className="h-1.5 -mx-6 -mt-6 mb-4 bg-[#12D7CD]" />
                {s.showLogo && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="size-7 rounded bg-[#041D39] text-white flex items-center justify-center"><Award className="size-4" /></div>
                    <span className="font-bold">{s.orgName || "Organisation"}</span>
                  </div>
                )}
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#041D39]/60">{fill(s.heading, vars)}</div>
                <p className="mt-4 text-xs text-[#041D39]/70">{fill(s.introLine, vars)}</p>
                <div className="text-xl font-bold mt-1">{vars.name}</div>
                <p className="mt-3 text-xs text-[#041D39]/70">{fill(s.completionLine, vars)}</p>
                <div className="text-sm font-semibold mt-1">{vars.module}</div>
                <div className="mt-4 inline-flex gap-4 rounded-md bg-[#041D39]/[0.04] px-4 py-2 text-xs">
                  <span><b className="text-base">{vars.score}</b> score</span>
                  <span><b className="text-base">{vars.date}</b></span>
                </div>
                <div className="mt-6 text-left">
                  <div className="h-px bg-[#041D39]/30 mb-1" />
                  {s.signatoryName ? (
                    <>
                      <div className="text-xs font-semibold">{s.signatoryName}</div>
                      {s.signatoryTitle && <div className="text-[10px] text-[#041D39]/60">{s.signatoryTitle}</div>}
                    </>
                  ) : (
                    <div className="text-[10px] text-[#041D39]/60">{fill(s.footer, vars)}</div>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground text-center">Sample data shown.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10" />
    </div>
  );
}
