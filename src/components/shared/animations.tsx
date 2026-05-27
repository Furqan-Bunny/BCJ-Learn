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
        color: ["#041D39", "#49FFAA", "#10b981", "#8b5cf6", "#f59e0b"][i % 5],
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

/* ─── MagneticButton ──────────────────────────────────────────────────── */
// Subtle cursor-following pull. Disabled on coarse pointers (touch) and on
// reduced-motion. Wrap a <Button> with this on hero CTAs only — too much
// magnetism across an app feels gimmicky.

export function MagneticButton({
  children,
  className,
  strength = 0.25,
}: {
  children: React.ReactNode;
  className?: string;
  /** 0..1 — fraction of cursor displacement applied to the element. Default 0.25. */
  strength?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });

  React.useEffect(() => {
    if (reduced) return;
    if (typeof window === "undefined") return;
    // Skip on coarse pointers (touch devices) — magnetism is a mouse feature.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const el = ref.current;
    if (!el) return;

    function onMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set((e.clientX - cx) * strength);
      y.set((e.clientY - cy) * strength);
    }
    function onLeave() {
      x.set(0);
      y.set(0);
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, strength, x, y]);

  if (reduced) {
    return <span className={cn("inline-block", className)}>{children}</span>;
  }

  return (
    <motion.span
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x: springX, y: springY }}
    >
      {children}
    </motion.span>
  );
}

/* ─── TiltCard ────────────────────────────────────────────────────────── */
// 3D perspective tilt that follows the cursor. Max 4° on either axis.
// Plus a soft highlight that tracks the cursor across the surface.

export function TiltCard({
  children,
  className,
  maxTiltDeg = 4,
}: {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
}) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-1, 1], [maxTiltDeg, -maxTiltDeg]);
  const rotateY = useTransform(mx, [-1, 1], [-maxTiltDeg, maxTiltDeg]);
  const springRX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springRY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    mx.set(px * 2 - 1);
    my.set(py * 2 - 1);
    // Position the highlight as a CSS variable so the pseudo-/child element can read it.
    e.currentTarget.style.setProperty("--tilt-mx", `${px * 100}%`);
    e.currentTarget.style.setProperty("--tilt-my", `${py * 100}%`);
  }
  function onPointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    mx.set(0);
    my.set(0);
    e.currentTarget.style.removeProperty("--tilt-mx");
    e.currentTarget.style.removeProperty("--tilt-my");
  }

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn("relative tilt-card", className)}
      style={{
        rotateX: springRX,
        rotateY: springRY,
        transformPerspective: 1000,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── DrawCheck (SVG path-draw checkmark) ─────────────────────────────── */
// A clean Apple-Pay-style checkmark whose stroke draws in over ~480 ms.

export function DrawCheck({
  size = 64,
  className,
  durationMs = 480,
}: {
  size?: number;
  className?: string;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <motion.circle
        cx="32"
        cy="32"
        r="29"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: durationMs / 1000, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d="M20 33 L29 42 L46 24"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: durationMs / 1000, delay: (durationMs / 1000) * 0.45, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

/* ─── RippleButton ────────────────────────────────────────────────────── */
// Wraps a <button> with a Material-style ripple originating from the click
// point. Opt-in — applies only where wrapped.

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function RippleButton({
  children,
  className,
  onClick,
  disabled,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduced = useReducedMotion();
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const idRef = React.useRef(0);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!reduced && !disabled) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.4;
      const id = ++idRef.current;
      setRipples((prev) => [...prev, { id, x, y, size }]);
      window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    }
    onClick?.(e);
  }

  return (
    <button
      {...rest}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      className={cn("relative overflow-hidden", className)}
    >
      {children}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-current opacity-20"
          initial={{ width: 0, height: 0, x: r.x, y: r.y, opacity: 0.28 }}
          animate={{ width: r.size, height: r.size, x: r.x - r.size / 2, y: r.y - r.size / 2, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </button>
  );
}

/* ─── AppLoader ───────────────────────────────────────────────────────── */
// Branded full-page loader. Logo gently pulses; three dots wave in sequence.

export function AppLoader({ label = "Loading BCJ Learn", messages }: { label?: string; messages?: string[] }) {
  const reduced = useReducedMotion();
  const steps = messages && messages.length > 0 ? messages : null;
  const [stepIdx, setStepIdx] = React.useState(0);
  React.useEffect(() => {
    if (!steps || steps.length <= 1) return;
    const t = setInterval(() => setStepIdx((p) => (p + 1) % steps.length), 950);
    return () => clearInterval(t);
  }, [steps?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-12rem)] w-full">
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20"
          animate={reduced ? undefined : { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
            <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
          </svg>
        </motion.div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-primary"
              animate={reduced ? undefined : { y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            />
          ))}
        </div>
        {steps ? (
          <motion.span
            key={stepIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-muted-foreground tracking-wider uppercase"
          >
            {steps[stepIdx]}
          </motion.span>
        ) : (
          <span className="text-xs text-muted-foreground tracking-wider uppercase">{label}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Re-exports for convenience ─────────────────────────────────────── */
export { motion, AnimatePresence, useTransform, useMotionValue, useSpring, useReducedMotion };
