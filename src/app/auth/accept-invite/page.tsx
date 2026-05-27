"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, CheckCircle2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import { getInvite, acceptInvite } from "@/lib/server/invite-actions";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 8;

export default function AcceptInvitePage() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [token, setToken] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // Brand logo (public branding bucket). Falls back to the icon mark on error.
  const logoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/branding/bcj-logo.png`;
  const [logoOk, setLogoOk] = React.useState(true);

  // Validate the token from the URL and pre-fill the form.
  React.useEffect(() => {
    let cancelled = false;
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setError("This invite link is invalid. Ask your admin to resend it.");
      return;
    }
    setToken(t);
    (async () => {
      const res = await getInvite(t);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail(res.email);
      setName(res.name);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  const pwMismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const pwTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    ready &&
    name.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !token) return;
    setSubmitting(true);

    // 1. Validate token server-side, set the password, activate the profile.
    const res = await acceptInvite({ token, name: name.trim(), password });
    if (!res.ok) {
      toast.error(res.error ?? "Could not complete setup");
      setSubmitting(false);
      return;
    }

    // 2. Sign in with the brand-new password.
    const supabase = createClient();
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: res.email,
      password,
    });
    if (signInErr || !data.user) {
      // Account is set up; just send them to login if auto sign-in failed.
      toast.success("Account ready — please sign in.");
      router.push("/login");
      return;
    }

    // 3. Optional: upload the chosen photo now that a session exists.
    if (avatarFile) {
      try {
        const { url } = await uploadAvatar(data.user.id, avatarFile);
        await supabase.from("profiles").update({ avatar_url: url }).eq("id", data.user.id);
      } catch {
        /* non-fatal — they can add a photo later from Settings → Profile */
      }
    }

    setDone(true);
    setSubmitting(false);
    toast.success("Welcome to BCJ Learn");
    setTimeout(() => router.push("/"), 1000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          {logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="BCJ Building Services"
              onError={() => setLogoOk(false)}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <>
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <div className="font-semibold text-lg tracking-tight">BCJ Learn</div>
            </>
          )}
        </div>

        <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-wider">
          Welcome
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Set up your account</h1>
        <p className="text-muted-foreground mt-2">
          A few quick details — should take less than a minute.
        </p>

        {error && (
          <div className="mt-6 rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {done ? (
          <div className="mt-8 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="size-4" /> All set — taking you to your dashboard…
          </div>
        ) : !error ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPick}
            />

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <UserAvatar name={name || email} avatarUrl={avatarPreview} avatarColor="#041D39" size="lg" className="size-16" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!ready}
              >
                <Camera className="size-3.5 mr-1.5" />
                {avatarPreview ? "Change photo" : "Add a photo"}
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
                disabled={!ready}
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
              <PasswordInput
                id="set-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="h-11"
                required
                disabled={!ready}
              />
              {pwTooShort && (
                <p className="text-xs text-rose-600">Password must be at least {MIN_PASSWORD_LENGTH} characters.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-11"
                required
                disabled={!ready}
              />
              {pwMismatch && (
                <p className="text-xs text-rose-600">Passwords don&rsquo;t match.</p>
              )}
            </div>

            <Button type="submit" disabled={!canSubmit || submitting} className="w-full h-11 mt-2">
              {submitting ? "Setting up…" : <>Finish setup <ArrowRight className="size-4 ml-1" /></>}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
