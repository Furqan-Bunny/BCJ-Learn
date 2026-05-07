"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, GraduationCap, BookOpen, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

export default function LoginPage() {
  const router = useRouter();
  const setRole = useRoleStore((s) => s.setRole);

  const [email, setEmail] = React.useState("nancy@bcj.com");
  const [password, setPassword] = React.useState("••••••••••");
  const [showRolePick, setShowRolePick] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [hovered, setHovered] = React.useState<Role | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Simulate auth
    setTimeout(() => {
      setSubmitting(false);
      setShowRolePick(true);
    }, 500);
  }

  function pickRole(r: Role) {
    setRole(r);
    const route = ROLES.find((x) => x.id === r)!.route;
    router.push(route);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 w-[6px] bg-[var(--gold)]"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ originY: 0 }}
        />
        {/* Subtle radial glow */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.18 }}
          transition={{ duration: 1.4 }}
          className="absolute -top-40 -right-40 size-[520px] rounded-full bg-[var(--gold)] blur-3xl pointer-events-none"
        />
        <div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-2 mb-12"
          >
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary-foreground/10">
              <Sparkles className="size-5" />
            </div>
            <div className="font-semibold text-lg tracking-tight">BCJ Learn</div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold leading-tight tracking-tight max-w-md"
          >
            Train every Employee. Prove they got it.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-primary-foreground/80 max-w-md"
          >
            BCJ&rsquo;s custom training and quiz platform — five modules, on-site testing, instant results, and a live admin dashboard.
          </motion.p>
        </div>

        <div className="space-y-3 max-w-md">
          {[
            "85% pass threshold, retakes auto-scheduled",
            "AI-drafted questions, BCJ-approved",
            "Full reporting for QBRs and HR",
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

        <div className="text-xs text-primary-foreground/60">
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
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="font-semibold tracking-tight">BCJ Learn</div>
          </div>

          <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-wider">
            Welcome back
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">Sign in to BCJ Learn</h2>
          <p className="text-muted-foreground mt-2">
            Use your work email and password. New here? Your admin sent an invite.
          </p>

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
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-11 mt-2">
              {submitting ? "Signing in…" : <>Sign in <ArrowRight className="size-4 ml-1" /></>}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              By signing in, you agree to BCJ&rsquo;s acceptable-use policy.
            </p>
          </form>
        </motion.div>
      </div>

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
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onMouseEnter={() => setHovered(r.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => pickRole(r.id)}
                  className={cn(
                    "group flex items-center gap-4 rounded-xl border p-4 text-left transition-colors",
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
                </motion.button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
