"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [sessionReady, setSessionReady] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // The reset email lands here with the recovery credentials in the URL. Two
  // shapes are possible depending on the project's auth flow:
  //   • implicit  → "#access_token=…&refresh_token=…&type=recovery" (hash)
  //   • PKCE      → "?code=…" (query)
  // We handle both explicitly (rather than racing the client's auto-detect),
  // establish the session, then scrub the credentials from the address bar.
  const INVALID_MSG = "Reset link is invalid or expired. Request a new one from the login page.";
  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      const hash = window.location.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errDesc = hashParams.get("error_description") || url.searchParams.get("error_description");

      const finish = (ok: boolean) => {
        if (cancelled) return;
        if (ok) {
          setSessionReady(true);
          // Drop the token/code from the URL so a refresh or back-nav can't
          // replay it and it isn't left visible in the address bar.
          window.history.replaceState(null, "", url.pathname);
        } else {
          setSessionError(INVALID_MSG);
        }
      };

      if (errDesc) return finish(false);

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return finish(!error);
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return finish(!error);
      }

      // No credentials in the URL — only valid if a recovery session already exists.
      const { data } = await supabase.auth.getSession();
      return finish(!!data.session);
    }

    void init();

    // Backstop: if the client emits PASSWORD_RECOVERY (auto-detect), accept it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setSessionError(null);
        setSessionReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const pwMismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const pwTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit = sessionReady && !pwMismatch && !pwTooShort && password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message || "Could not update password");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
    toast.success("Password updated");
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
          Password reset
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
        <p className="text-muted-foreground mt-2">
          Choose a password with at least {MIN_PASSWORD_LENGTH} characters.
        </p>

        {sessionError && (
          <div className="mt-6 rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-3 text-sm text-rose-700 dark:text-rose-300">
            {sessionError}
          </div>
        )}

        {done ? (
          <div className="mt-8 rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="size-4" /> Password updated — redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
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
              {submitting ? "Updating…" : <>Update password <ArrowRight className="size-4 ml-1" /></>}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
