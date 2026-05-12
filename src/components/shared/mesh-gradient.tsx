"use client";

// Animated mesh-gradient background. Three radial-gradient blobs drifting on
// their own slow keyframes, all blended over a dark base colour. Pure CSS —
// no JS, no canvas, no SVG. GPU-friendly (only `transform` is animated).
//
// Honours `prefers-reduced-motion` via globals.css.
//
// Usage:
//   <div className="relative ...">
//     <MeshGradient />
//     ...content
//   </div>

import { cn } from "@/lib/utils";

export function MeshGradient({
  className,
  /** Base layer colour underneath the blobs. Defaults to current `--primary`. */
  baseClassName = "bg-primary",
}: {
  className?: string;
  baseClassName?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        baseClassName,
        className,
      )}
    >
      {/* Three drifting blobs. Each is a fixed-size element with a radial
          gradient, blurred and animated via translate keyframes. */}
      <span className="mesh-blob mesh-blob-1" />
      <span className="mesh-blob mesh-blob-2" />
      <span className="mesh-blob mesh-blob-3" />
      {/* Subtle vignette to keep edges quiet. */}
      <span className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_50%,rgba(0,0,0,0.25))]" />
    </div>
  );
}
