"use client";

import * as React from "react";
import { Loader2, Download } from "lucide-react";
import mammoth from "mammoth/mammoth.browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

/**
 * Inline preview for Word .docx files: fetches the signed URL, converts the
 * document to HTML in the browser (mammoth), and renders it with the shared
 * .help-doc typography. A download link stays available for the original file.
 * Falls back to a download-only view if conversion fails (e.g. old .doc).
 */
export function DocxPreview({
  url,
  fileName,
  className,
}: {
  url: string;
  fileName?: string | null;
  className?: string;
}) {
  const t = useT();
  const [html, setHtml] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value?.trim() || "<p></p>");
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (failed) {
    return (
      <div className="p-12 text-center">
        <div className="text-sm text-muted-foreground mb-4">
          {t("content.previewUnavailable", { name: fileName ?? t("content.uploadedFile") })}
        </div>
        <Button asChild>
          <a href={url} download={fileName ?? undefined} target="_blank" rel="noreferrer">
            <Download className="size-4 mr-1.5" /> {t("common.download")}
          </a>
        </Button>
      </div>
    );
  }

  if (html === null) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" /> {t("content.preparing")}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Quiet download link for the original file, top-right. */}
      <div className="sticky top-0 z-10 flex justify-end px-4 pt-3 -mb-2">
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <a href={url} download={fileName ?? undefined} target="_blank" rel="noreferrer">
            <Download className="size-3.5 mr-1" /> {t("common.download")}
          </a>
        </Button>
      </div>
      <div
        className="help-doc px-8 pb-8 pt-2 max-w-none"
        // Converted from our own trusted .docx in Supabase Storage.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
