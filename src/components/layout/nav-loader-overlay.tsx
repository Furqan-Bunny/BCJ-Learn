"use client";

// Full content-area loader shown on every in-app navigation. Because pages can
// load fast, the route-level loading.tsx only flashes — this overlay guarantees
// the branded "circle + cycling messages" loader is visible for a minimum time
// on every navigation, so users always see that their page is loading.

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppLoader } from "@/components/shared/animations";

const MIN_VISIBLE_MS = 700;

export function NavLoaderOverlay() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [loading, setLoading] = React.useState(false);
  const startedAt = React.useRef(0);
  const lastPath = React.useRef(pathname);

  // Detect a navigation about to happen (internal link click).
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      startedAt.current = performance.now();
      setLoading(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Hide once the new page has mounted — but keep it up for a minimum time.
  React.useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (!loading) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - startedAt.current));
    const t = window.setTimeout(() => setLoading(false), wait);
    return () => window.clearTimeout(t);
  }, [pathname, loading]);

  // Safety: never get stuck.
  React.useEffect(() => {
    if (!loading) return;
    const s = window.setTimeout(() => setLoading(false), 8000);
    return () => window.clearTimeout(s);
  }, [loading]);

  if (reduced) return null;

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-40 bg-background/85 backdrop-blur-sm flex items-start justify-center pt-16"
        >
          <AppLoader
            messages={[
              "Loading the page…",
              "Fetching your data…",
              "Almost there…",
            ]}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
