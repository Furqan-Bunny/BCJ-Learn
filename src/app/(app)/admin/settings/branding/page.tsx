"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Palette, ImageIcon, Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";

export default function BrandingSettings() {
  const [name, setName] = React.useState("BCJ Learn");
  const [primary, setPrimary] = React.useState("#1F3A5F");
  const [accent, setAccent] = React.useState("#C89B5C");
  const [emailFrom, setEmailFrom] = React.useState("learn@bcj.com");

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Branding & identity"
        description="Configure how BCJ Learn looks to managers and what name appears on emails."
      />

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4" /> Platform name
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Displayed name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                <p className="text-xs text-muted-foreground">Shows in the sidebar logo, login page, and browser tab.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="size-4" /> Brand colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Primary (navy)</Label>
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-md border" style={{ background: primary }} />
                    <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Accent (gold)</Label>
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-md border" style={{ background: accent }} />
                    <Input value={accent} onChange={(e) => setAccent(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="size-4" /> Logo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer">
                <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                Drop an SVG or PNG here, or click to upload
                <div className="mt-2 text-xs">Recommended: 256×256, transparent background</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4" /> Email sender
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Sender address</Label>
                <Input type="email" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} />
                <p className="text-xs text-muted-foreground">All BCJ Learn emails go out from this address.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline">Discard</Button>
            <Button onClick={() => toast.success("Branding saved")}>Save changes</Button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Live preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: primary, color: "white" }}>
                  <div className="size-7 rounded flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="font-semibold tracking-tight">{name}</div>
                </div>
                <div className="p-4 bg-card">
                  <div className="font-semibold">Welcome back</div>
                  <p className="text-sm text-muted-foreground mt-1">Your Module 1 quiz is scheduled for June 12, 2026.</p>
                  <button className="mt-4 px-3 py-2 text-sm font-medium rounded-md text-white" style={{ background: primary }}>
                    Start studying
                  </button>
                </div>
                <div className="px-4 py-3 border-t" style={{ background: accent + "10" }}>
                  <div className="text-xs flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: accent }} />
                    <span className="font-mono uppercase tracking-wider text-muted-foreground">Up next · M2 Quality Control</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground text-center">
                Manager dashboard preview
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
