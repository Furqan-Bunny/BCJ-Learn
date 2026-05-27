"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, GraduationCap, BookOpen, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { requestLoginOtp, verifyLoginOtp } from "@/lib/server/auth-actions";
import { toast } from "sonner";
import { MeshGradient } from "@/components/shared/mesh-gradient";
import { MagneticButton, TiltCard, DrawCheck } from "@/components/shared/animations";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const ROLES: { id: Role; title: string; subtitle: string; icon: typeof GraduationCap; route: string }[] = [
  {
    id: "manager",
    title: "Employee",
    subtitle: "Take quizzes, study your modules, track your progress.",
    icon: GraduationCap,
    route: "/manager/dashboard",
  },
  {
    id: "teacher",
    title: "Department Lead/Manager",
    subtitle: "Approve AI-drafted questions, see your module results.",
    icon: BookOpen,
    route: "/teacher/dashboard",
  },
  {
    id: "admin",
    title: "Admin",
    subtitle: "Full program oversight, dashboards, and reporting.",
    icon: ShieldCheck,
    route: "/admin/dashboard",
  },
];

const ROLE_ROUTE: Record<Role, string> = {
  manager: "/manager/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const setRole = useRoleStore((s) => s.setRole);
  const setAuthedUserId = useRoleStore((s) => s.setAuthedUserId);

  const [email, setEmail] = React.useState(DEMO_MODE ? "nancy@bcj.com" : "");
  const [password, setPassword] = React.useState(DEMO_MODE ? "••••••••••" : "");
  const [showRolePick, setShowRolePick] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [hovered, setHovered] = React.useState<Role | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [otpStep, setOtpStep] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSubmitting, setOtpSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [showForgot, setShowForgot] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotSubmitting, setForgotSubmitting] = React.useState(false);
  const [forgotSent, setForgotSent] = React.useState(false);

  // Brand logo (public branding bucket). Falls back to the icon mark on error.
  const logoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/branding/bcj-logo.png`;
  const [logoOk, setLogoOk] = React.useState(true);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSubmitting(true);

    if (DEMO_MODE) {
      // Don't hit Supabase in demo mode — just show the confirmation.
      await new Promise((r) => setTimeout(r, 400));
      setForgotSent(true);
      setForgotSubmitting(false);
      return;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo });
    // Always show success (don't leak whether email exists).
    setForgotSent(true);
    setForgotSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAuthError(null);

    // ─── Demo mode: skip real auth, show role-pick modal ──────────
    if (DEMO_MODE) {
      setTimeout(() => {
        setSubmitting(false);
        setShowRolePick(true);
      }, 400);
      return;
    }

    // ─── Production mode: real Supabase Auth ──────────────────────
    // Check whether this account requires an emailed sign-in code (2FA).
    const res = await requestLoginOtp(email, password);
    if (!res.ok) {
      setAuthError(res.error ?? "Sign-in failed");
      setSubmitting(false);
      return;
    }
    if (res.requiresOtp) {
      setOtpStep(true);
      setSubmitting(false);
      toast.success("We emailed you a sign-in code");
      return;
    }
    // No 2FA → finish sign-in now.
    const ok = await completeSignIn();
    if (!ok) setSubmitting(false);
  }

  // Establishes the real session (password is still in component state) and
  // routes to the role-appropriate dashboard. Used by both the no-2FA path and
  // after a verified OTP.
  async function completeSignIn(): Promise<boolean> {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setAuthError(error?.message ?? "Sign-in failed");
      return false;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    const userRole: Role = ((profile as { role?: Role } | null)?.role ?? "manager") as Role;
    setRole(userRole);
    setAuthedUserId(data.user.id);
    toast.success("Signed in");
    router.push(ROLE_ROUTE[userRole]);
    return true;
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpSubmitting(true);
    setAuthError(null);
    const res = await verifyLoginOtp(email, otpCode);
    if (!res.ok) {
      setAuthError(res.error ?? "Verification failed");
      setOtpSubmitting(false);
      return;
    }
    const ok = await completeSignIn();
    if (!ok) setOtpSubmitting(false);
  }

  async function handleResendOtp() {
    setResending(true);
    setAuthError(null);
    const res = await requestLoginOtp(email, password);
    setResending(false);
    if (!res.ok) {
      setAuthError(res.error ?? "Could not resend the code");
      return;
    }
    toast.success("New code sent");
  }

  function pickRole(r: Role) {
    setRole(r);
    router.push(ROLE_ROUTE[r]);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground overflow-hidden">
        <MeshGradient />
        <motion.div
          className="absolute inset-y-0 left-0 w-[6px] bg-[var(--gold)] z-10"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ originY: 0 }}
        />
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-2 mb-12"
          >
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="BCJ Building Services"
                onError={() => setLogoOk(false)}
                className="h-11 w-auto object-contain rounded-md bg-white px-3 py-1.5"
              />
            ) : (
              <>
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary-foreground/10">
                  <Sparkles className="size-5" />
                </div>
                <div className="font-semibold text-lg tracking-tight">BCJ Learn</div>
              </>
            )}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold leading-tight tracking-tight max-w-md text-gradient-shift"
          >
            Train every team member. Build confidence at every level.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-primary-foreground/80 max-w-md"
          >
            BCJ&rsquo;s custom training platform for company-wide learning, manager development, and consistent standards across every team. Team members complete assigned modules, take BCJ-approved knowledge checks, get instant results, and are guided through retakes automatically.
          </motion.p>
        </div>

        <div className="space-y-3 max-w-md relative z-10">
          {[
            "Knowledge checks with an 85% readiness threshold",
            "Automatic retakes and reminders",
            "Live admin & department-level reporting for QBRs, HR, and compliance",
          ].map((line, i) => (
            <motion.div
              key={line}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3"
            >
              <CheckCircle2 className="size-4 text-[var(--gold)]" />
              <span className="text-sm text-primary-foreground/85">{line}</span>
            </motion.div>
          ))}
        </div>

        <div className="text-xs text-primary-foreground/60 relative z-10">
          Prepared by Ten80ten · contact@alexnicholson.com
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex items-center justify-center p-8 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-10">
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="BCJ Building Services"
                onError={() => setLogoOk(false)}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <>
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="font-semibold tracking-tight">BCJ Learn</div>
              </>
            )}
          </div>

          <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-wider">
            Welcome back
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">Sign in to BCJ Learn</h2>
          <p className="text-muted-foreground mt-2">
            Use your work email and password. New here? Your admin sent an invite.
          </p>

          {otpStep ? (
            <form className="mt-8 space-y-4" onSubmit={handleVerifyOtp}>
              <p className="text-sm text-muted-foreground">
                We emailed a 6-digit code to{" "}
                <span className="font-medium text-foreground">{email}</span>. Enter it to finish signing in.
              </p>
              <div className="space-y-2">
                <Label htmlFor="otp">Sign-in code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="h-11 text-center text-lg font-mono tracking-[0.4em]"
                />
              </div>

              {authError && (
                <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                  {authError}
                </div>
              )}

              <Button type="submit" disabled={otpSubmitting || otpCode.length < 6} className="w-full h-11">
                {otpSubmitting ? "Verifying…" : <>Verify &amp; sign in <ArrowRight className="size-4 ml-1" /></>}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtpCode(""); setAuthError(null); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@bcj.com"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSent(false);
                    setShowForgot(true);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            {authError && (
              <div className="rounded-md border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {authError}
              </div>
            )}

            <MagneticButton className="w-full block mt-2" strength={0.18}>
              <Button type="submit" disabled={submitting} className="w-full h-11">
                {submitting ? "Signing in…" : <>Sign in <ArrowRight className="size-4 ml-1" /></>}
              </Button>
            </MagneticButton>

            {!DEMO_MODE && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Seed users use password <span className="font-mono">BcjLearnDemo2026!</span>
              </p>
            )}

            <p className="text-xs text-muted-foreground text-center mt-4">
              By signing in, you agree to BCJ&rsquo;s acceptable-use policy.
            </p>
          </form>
          )}
        </motion.div>
      </div>

      {/* Forgot password modal */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your work email. If an account exists, we&rsquo;ll send a reset link.
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
              <DrawCheck size={28} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                Done. Check your inbox for the reset link.
                {DEMO_MODE && (
                  <div className="mt-1 text-xs italic opacity-80">(Demo mode — no email actually sent.)</div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Work email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@bcj.com"
                  required
                  autoFocus
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={forgotSubmitting || !forgotEmail} className="w-full h-11">
                {forgotSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Role-pick modal */}
      <Dialog open={showRolePick} onOpenChange={setShowRolePick}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider">
              Demo mode
            </Badge>
            <DialogTitle className="text-2xl">Pick a role to enter</DialogTitle>
            <DialogDescription>
              This is a demo of BCJ Learn. Each role shows a different view of the platform.
              You can switch any time from the topbar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {ROLES.map((r, i) => {
              const Icon = r.icon;
              const isHover = hovered === r.id;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TiltCard className="rounded-xl">
                    <button
                      onMouseEnter={() => setHovered(r.id)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => pickRole(r.id)}
                      className={cn(
                        "group w-full flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors",
                        "hover:border-primary hover:bg-primary/5",
                        isHover && "shadow-md",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center size-11 rounded-lg shrink-0 transition-colors",
                          "bg-muted group-hover:bg-primary group-hover:text-primary-foreground",
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-sm text-muted-foreground">{r.subtitle}</div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </button>
                  </TiltCard>
                </motion.div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
