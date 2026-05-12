"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, CheckCircle2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 8;

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [sessionReady, setSessionReady] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [avatarColor, setAvatarColor] = React.useState("#1F3A5F");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Magic-link from invite email lands here; @supabase/ssr exchanges it for a session.
  React.useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        setSessionError("Invitation link is invalid or expired. Ask your admin to send a new one.");
        return;
      }
      const u = data.session.user;
      setUserId(u.id);
      setEmail(u.email ?? "");
      setName(((u.user_metadata as { name?: string } | null)?.name) ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_color, avatar_url, name")
        .eq("id", u.id)
        .single();
      if (profile) {
        const p = profile as { avatar_color?: string; avatar_url?: string | null; name?: string };
        if (p.avatar_color) setAvatarColor(p.avatar_color);
        if (p.avatar_url) setAvatarUrl(p.avatar_url);
        if (p.name && !((u.user_metadata as { name?: string } | null)?.name)) setName(p.name);
      }
      setSessionReady(true);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const { url } = await uploadAvatar(userId, file);
      setAvatarUrl(url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const pwMismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const pwTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    sessionReady &&
    name.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !userId) return;
    setSubmitting(true);

    // 1. Set the password (replaces the magic-link only access)
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      toast.error(pwErr.message || "Could not set password");
      setSubmitting(false);
      return;
    }

    // 2. Update profile with the (possibly corrected) name + avatar_url
    const updates: Record<string, unknown> = { name: name.trim() };
    if (avatarUrl) updates.avatar_url = avatarUrl;
    await supabase.from("profiles").update(updates).eq("id", userId);

    setDone(true);
    setSubmitting(false);
    toast.success("Welcome to BCJ Learn");
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="font-semibold text-lg tracking-tight">BCJ Learn</div>
        </div>

        <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-wider">
          Welcome
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Set up your account</h1>
        <p className="text-muted-foreground mt-2">
          A few quick details — should take less than a minute.
        </p>

        {sessionError && (
          <div className="mt-6 rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-3 text-sm text-rose-700 dark:text-rose-300">
            {sessionError}
          </div>
        )}

        {done ? (
          <div className="mt-8 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="size-4" /> All set — taking you to your dashboard…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <UserAvatar name={name || email} avatarUrl={avatarUrl} avatarColor={avatarColor} size="lg" className="size-16" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!sessionReady || uploading}
              >
                <Camera className="size-3.5 mr-1.5" />
                {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
              </Button>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Jordan Patel"
                className="h-11"
                required
                disabled={!sessionReady}
              />
            </div>

            {/* Email — read-only */}
            <div className="space-y-2">
              <Label>Work email</Label>
              <Input value={email} disabled className="h-11 text-muted-foreground" />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="set-password">Set a password</Label>
              <Input
                id="set-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="h-11"
                required
                disabled={!sessionReady}
              />
              {pwTooShort && (
                <p className="text-xs text-rose-600">Password must be at least {MIN_PASSWORD_LENGTH} characters.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-11"
                required
                disabled={!sessionReady}
              />
              {pwMismatch && (
                <p className="text-xs text-rose-600">Passwords don&rsquo;t match.</p>
              )}
            </div>

            <Button type="submit" disabled={!canSubmit || submitting} className="w-full h-11 mt-2">
              {submitting ? "Setting up…" : <>Finish setup <ArrowRight className="size-4 ml-1" /></>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
