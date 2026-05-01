"use client";

import * as React from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── CountUp ──────────────────────────────────────────────────────────── */

interface CountUpProps {
  value: number;
  durationMs?: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}

export function CountUp({
  value,
  durationMs = 1200,
  decimals = 0,
  className,
  prefix = "",
  suffix = "",
  format,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(reduced ? value : 0);
  const spring = useSpring(mv, { duration: durationMs, bounce: 0 });
  const [display, setDisplay] = React.useState<string>(() =>
    format ? format(reduced ? value : 0) : (reduced ? value : 0).toFixed(decimals),
  );

  React.useEffect(() => {
    if (!inView) return;
    mv.set(value);
  }, [inView, value, mv]);

  React.useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDisplay(format ? format(v) : v.toFixed(decimals));
    });
    return unsub;
  }, [spring, decimals, format]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ─── FadeIn ──────────────────────────────────────────────────────────── */

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: keyof typeof motion;
}

export function FadeIn({ children, delay = 0, y = 8, className }: FadeInProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Stagger ─────────────────────────────────────────────────────────── */

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}

/**
 * Wrap a grid/list in <Stagger> and each direct child in <StaggerItem>.
 * Children animate in with a small staggered delay.
 */
export function Stagger({ children, className, delay = 0, stagger = 0.05 }: StaggerProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 12,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── ProgressBar (animated fill) ─────────────────────────────────────── */

interface AnimatedProgressProps {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
  durationMs?: number;
  showShimmer?: boolean;
}

export function AnimatedProgress({
  value,
  className,
  barClassName,
  durationMs = 900,
  showShimmer = false,
}: AnimatedProgressProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const target = Math.max(0, Math.min(100, value));
  return (
    <div ref={ref} className={cn("relative h-2 w-full rounded-full bg-muted overflow-hidden", className)}>
      <motion.div
        className={cn("absolute inset-y-0 left-0 rounded-full bg-primary", barClassName)}
        initial={reduced ? { width: `${target}%` } : { width: 0 }}
        animate={{ width: `${inView ? target : 0}%` }}
        transition={{ duration: durationMs / 1000, ease: [0.16, 1, 0.3, 1] }}
      />
      {showShimmer && !reduced && (
        <motion.div
          className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10"
          initial={{ x: "-100%" }}
          animate={{ x: "400%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: 0.6 }}
        />
      )}
    </div>
  );
}

/* ─── Live pulse dot ──────────────────────────────────────────────────── */

export function PulseDot({
  className,
  color = "bg-emerald-500",
}: {
  className?: string;
  color?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {!reduced && (
        <motion.span
          className={cn("absolute inset-0 rounded-full opacity-75", color)}
          animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

/* ─── Skeleton with shimmer ──────────────────────────────────────────── */

export function Shimmer({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      {!reduced && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

/* ─── Hover lift card wrapper ─────────────────────────────────────────── */

export function HoverLift({
  children,
  className,
  scale = 1.012,
}: {
  children: React.ReactNode;
  className?: string;
  scale?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      whileHover={{ y: -3, scale }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Search loading bar (ambient indicator) ─────────────────────────── */

export function SearchLoadingBar({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="search-bar"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0 }}
          transition={{ duration: 0.25 }}
          style={{ originX: 0 }}
          className="pointer-events-none absolute left-0 right-0 -bottom-px h-px overflow-hidden"
        >
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Confetti burst (lightweight, no deps) ──────────────────────────── */

export function ConfettiBurst({ active, count = 36 }: { active: boolean; count?: number }) {
  const reduced = useReducedMotion();
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 800,
        y: 200 + Math.random() * 400,
        rot: Math.random() * 540,
        scale: 0.6 + Math.random() * 0.8,
        delay: Math.random() * 0.18,
        color: ["#1F3A5F", "#C89B5C", "#10b981", "#8b5cf6", "#f59e0b"][i % 5],
      })),
    [count],
  );

  if (reduced || !active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/3 size-2.5 rounded-sm"
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.rot, opacity: 0 }}
          transition={{ duration: 1.4, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/* ─── Page transition wrapper ─────────────────────────────────────────── */

export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Animated number for percentages with custom formatter ──────────── */

export function PercentCountUp({ value, className }: { value: number; className?: string }) {
  return <CountUp value={value} suffix="%" decimals={0} className={className} />;
}

/* ─── Re-exports for convenience ─────────────────────────────────────── */
export { motion, AnimatePresence, useTransform, useMotionValue, useSpring, useReducedMotion };
