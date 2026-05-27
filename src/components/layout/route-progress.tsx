"use client";

// Top route progress bar — shows on every <Link> navigation across the app.
//
// How it works:
//   1. On mount, install a document-level click listener that detects any
//      anchor click whose `href` is a same-origin path that isn't the
//      current one. When it sees one, it kicks the bar into motion.
//   2. The bar animates 0 → ~80% over 600 ms (slow ease-out — "loading").
//   3. When `usePathname()` finally updates (page has mounted), it completes
//      to 100% then fades out.
//
// Filtered: external links, downloads, target=_blank, modifier-clicks.
// Reduced-motion: bar hidden entirely.

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export function RouteProgress() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [active, setActive] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const navigatingPath = React.useRef<string | null>(null);
  const lastPathname = React.useRef(pathname);
  const incrementTimer = React.useRef<number | null>(null);
  const startedAt = React.useRef<number>(0);

  // Intercept link clicks to detect a navigation about to happen.
  React.useEffect(() => {
    if (reduced) return;

    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Walk up the tree to find an <a>.
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.routeProgressSkip === "true") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      // Skip hash-only and non-internal links.
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // No-op nav to same URL.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // Start the bar immediately so it's visible on every navigation.
      navigatingPath.current = url.pathname;
      startedAt.current = performance.now();
      setActive(true);
      setProgress(0);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [reduced]);

  // Safety: if a click started the bar but no navigation actually happened,
  // auto-hide after a few seconds so it never sticks.
  React.useEffect(() => {
    if (!active) return;
    const safety = window.setTimeout(() => setActive(false), 8000);
    return () => window.clearTimeout(safety);
  }, [active]);

  // Animate progress 0 → 80% over ~600 ms whenever the bar becomes active.
  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const startedAt = performance.now();
    const duration = 600;
    const target = 80;

    function tick(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - startedAt) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * target);
      if (t < 1) incrementTimer.current = window.requestAnimationFrame(tick);
    }
    incrementTimer.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (incrementTimer.current) cancelAnimationFrame(incrementTimer.current);
    };
  }, [active]);

  // When pathname finally updates, finish the bar.
  React.useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    navigatingPath.current = null;
    if (!active) return;

    // Snap to 100%, then keep the bar visible for a minimum time so even
    // instant navigations show a clear "loading" cue.
    setProgress(100);
    const MIN_VISIBLE = 650;
    const elapsed = performance.now() - startedAt.current;
    const wait = Math.max(260, MIN_VISIBLE - elapsed);
    const t = window.setTimeout(() => setActive(false), wait);
    return () => window.clearTimeout(t);
  }, [pathname, active]);

  if (reduced) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="route-progress"
          className="fixed inset-x-0 top-0 z-[100] h-[3px] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="h-full route-progress-bar shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_60%,transparent)]"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
