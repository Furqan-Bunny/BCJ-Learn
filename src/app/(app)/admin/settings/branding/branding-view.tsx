"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Palette, ImageIcon, Mail, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import { uploadBrandingAsset, signedUrlForContent } from "@/lib/supabase/storage";
import { updateBrandingSettings } from "@/lib/server/settings-actions";
import type { BrandingSettings } from "@/lib/db/settings";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function BrandingView({ initial }: { initial: BrandingSettings }) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [primary, setPrimary] = React.useState(initial.primaryColor);
  const [accent, setAccent] = React.useState(initial.accentColor);
  const [emailFrom, setEmailFrom] = React.useState(initial.emailFrom);
  const [logoPath, setLogoPath] = React.useState<string | null>(initial.logoPath);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Note: branding bucket is public so we can use getPublicUrl directly,
  // but uploadBrandingAsset already returns the public URL with cache-bust.
  React.useEffect(() => {
    // If we have a stored logoPath, derive the public URL once.
    if (logoPath && !logoUrl) {
      // Branding bucket is public; build URL by convention. We could call
      // a server action but a direct getPublicUrl call works too.
      // For simplicity, just leave logoUrl null until user uploads anew.
    }
  }, [logoPath, logoUrl]);

  async function handleLogoFile(file: File) {
    if (DEMO_MODE) {
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
      toast.success("Logo preview updated (demo)");
      return;
    }
    setUploading(true);
    try {
      const { url, path } = await uploadBrandingAsset(file, "logo");
      setLogoUrl(url);
      setLogoPath(path);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await updateBrandingSettings({
      name,
      primaryColor: primary,
      accentColor: accent,
      emailFrom,
      logoPath,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save");
      return;
    }
    toast.success("Branding saved");
    router.refresh();
  }

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
                  <Label>Accent (brand teal)</Label>
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground hover:border-primary/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {logoUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo preview" className="h-16 object-contain" />
                    <span className="text-xs text-primary">Replace logo</span>
                  </div>
                ) : logoPath ? (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="size-8 opacity-60" />
                    <span className="text-xs">Current logo on file. Click to replace.</span>
                  </div>
                ) : uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-8 animate-spin opacity-50" />
                    <span>Uploading…</span>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                    Drop an SVG or PNG here, or click to upload
                    <div className="mt-2 text-xs">Recommended: 256×256, transparent background</div>
                  </div>
                )}
              </button>
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
            <Button variant="outline" onClick={() => router.refresh()}>Discard</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

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
                  <p className="text-sm text-muted-foreground mt-1">Your next training module is scheduled.</p>
                  <button className="mt-4 px-3 py-2 text-sm font-medium rounded-md text-white" style={{ background: primary }}>
                    Start studying
                  </button>
                </div>
                <div className="px-4 py-3 border-t" style={{ background: accent + "10" }}>
                  <div className="text-xs flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: accent }} />
                    <span className="font-mono uppercase tracking-wider text-muted-foreground">Up next</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground text-center">
                Employee dashboard preview
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
