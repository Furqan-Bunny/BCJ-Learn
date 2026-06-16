"use client";

// Resilient renderer for Office files (.pptx/.docx/.xlsx, etc.) via Microsoft's
// online viewer. The bare iframe used to hang silently when MS's 3rd-party viewer
// was slow or the 1-hour signed URL had expired (a real risk live in a seminar).
// This adds: a load timeout that surfaces a recovery overlay, a Reload that
// re-mints a fresh signed URL and forces the iframe to reload, plus Open-in-new-tab
// and Download escape hatches.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink, Download } from "lucide-react";
import { signedUrlForContent } from "@/lib/supabase/storage";

const LOAD_TIMEOUT_MS = 12_000;

function officeUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export function OfficeEmbed({
  path,
  title,
  initialUrl,
  className = "w-full h-[72vh] border-0 bg-white",
}: {
  /** Storage path in the private module-content bucket — used to re-mint a fresh signed URL on reload. */
  path: string;
  title?: string;
  /** An already-minted signed URL (optional) to avoid an extra round-trip on first paint. */
  initialUrl?: string;
  className?: string;
}) {
  const [fileUrl, setFileUrl] = React.useState<string | null>(initialUrl ?? null);
  const [signing, setSigning] = React.useState(!initialUrl);
  const [loaded, setLoaded] = React.useState(false);
  const [slow, setSlow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Bumping this key forces React to recreate the iframe (a true reload).
  const [reloadKey, setReloadKey] = React.useState(0);

  const sign = React.useCallback(async () => {
    setSigning(true);
    setError(null);
    try {
      const url = await signedUrlForContent(path);
      setFileUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this file.");
    } finally {
      setSigning(false);
    }
  }, [path]);

  // Mint a signed URL if we weren't handed one.
  React.useEffect(() => {
    if (!initialUrl) void sign();
  }, [initialUrl, sign]);

  // Watchdog: if the iframe hasn't loaded within the timeout, reveal the overlay.
  React.useEffect(() => {
    if (!fileUrl || loaded) return;
    setSlow(false);
    const t = setTimeout(() => setSlow(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [fileUrl, loaded, reloadKey]);

  async function reload() {
    setLoaded(false);
    setSlow(false);
    await sign(); // fresh signed URL (fixes the expired-URL case)
    setReloadKey((k) => k + 1);
  }

  if (error) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground`}>
        <p>Couldn&rsquo;t load this file. {error}</p>
        <Button size="sm" variant="outline" onClick={reload}>
          <RefreshCw className="size-3.5 mr-1.5" /> Try again
        </Button>
      </div>
    );
  }

  if (signing || !fileUrl) {
    return (
      <div className={`${className} flex items-center justify-center text-muted-foreground`}>
        <Loader2 className="size-5 mr-2 animate-spin" /> Preparing…
      </div>
    );
  }

  return (
    // The sizing className goes on the wrapper so the iframe's h-full has a sized
    // parent (otherwise an h-full caller collapses the iframe to a thin strip).
    <div className={`relative ${className}`}>
      <iframe
        key={reloadKey}
        src={officeUrl(fileUrl)}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="w-full h-full border-0 bg-white"
        title={title ?? "Document"}
      />
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 text-center p-6">
          {!slow ? (
            <div className="flex items-center text-sm text-slate-600">
              <Loader2 className="size-5 mr-2 animate-spin" /> Loading the document…
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">This is taking longer than usual.</p>
              <p className="text-xs text-slate-500 max-w-xs">
                The document viewer can be slow. Reload it, or open/download the file directly.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={reload}>
                  <RefreshCw className="size-3.5 mr-1.5" /> Reload
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={officeUrl(fileUrl)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5 mr-1.5" /> Open in new tab
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="size-3.5 mr-1.5" /> Download
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
