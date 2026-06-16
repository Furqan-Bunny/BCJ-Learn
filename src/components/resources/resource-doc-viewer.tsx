"use client";

// Renders a resource's content: stored file (PDF iframe / video / download),
// inline markdown body, an external link, or a notice-only fallback. Shared by
// the employee resources viewer and the admin resource detail page.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Download, ExternalLink } from "lucide-react";
import { signedUrlForContent } from "@/lib/supabase/storage";
import { OfficeEmbed } from "@/components/shared/office-embed";
import { useT } from "@/lib/i18n/provider";

const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "ogg"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const OFFICE_EXTS = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"];

export interface ResourceDocViewerResource {
  title: string;
  storagePath: string | null;
  body: string | null;
  externalUrl: string | null;
}

export function ResourceDocViewer({ resource }: { resource: ResourceDocViewerResource }) {
  const t = useT();
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    if (!resource.storagePath) return;
    signedUrlForContent(resource.storagePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [resource.storagePath]);

  // 1) Stored file (PDF / video / image / Office / other) takes priority.
  if (resource.storagePath) {
    const fileName = resource.storagePath.split("/").pop();
    const ext = resource.storagePath.toLowerCase().split(".").pop() ?? "";
    const isPdf = ext === "pdf";
    const isVideo = VIDEO_EXTS.includes(ext);
    const isImage = IMAGE_EXTS.includes(ext);
    const isOffice = OFFICE_EXTS.includes(ext);

    if (error) {
      return (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
          {t("doc.loadError", { error })}
        </div>
      );
    }
    if (!url) {
      return (
        <div className="rounded-lg border bg-muted/30 p-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" /> {t("doc.preparing")}
        </div>
      );
    }

    // A small toolbar (Download + Open) shared above every inline preview.
    const toolbar = (
      <div className="flex justify-end gap-1.5 mb-2">
        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <a href={url} download={fileName} target="_blank" rel="noreferrer">
            <Download className="size-3.5" /> {t("common.download")}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> {t("content.openTab")}
          </a>
        </Button>
      </div>
    );

    if (isPdf) {
      return <div>{toolbar}<iframe src={url} loading="lazy" className="w-full h-[65vh] rounded-lg border bg-white" title={resource.title} /></div>;
    }
    if (isVideo) {
      return <div>{toolbar}<video src={url} controls className="w-full rounded-lg border bg-black" /></div>;
    }
    if (isImage) {
      return (
        <div>{toolbar}
          <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-center max-h-[65vh] overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={resource.title} className="max-w-full max-h-[60vh] object-contain rounded-md" />
          </div>
        </div>
      );
    }
    if (isOffice) {
      return (
        <div>{toolbar}
          <OfficeEmbed path={resource.storagePath} initialUrl={url} title={resource.title} className="w-full h-[65vh] rounded-lg border bg-white" />
          <div className="text-[11px] text-muted-foreground mt-1.5 text-right">{t("content.renderingExternally")}</div>
        </div>
      );
    }
    // Unknown binary — offer a download.
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center">
        <FileText className="size-10 mx-auto opacity-40 mb-3" />
        <div className="text-sm text-muted-foreground mb-4">{t("doc.noPreview")}</div>
        <Button asChild>
          <a href={url} download={fileName} target="_blank" rel="noreferrer">
            <Download className="size-4 mr-1.5" /> {t("common.download")}
          </a>
        </Button>
      </div>
    );
  }

  // 2) Inline markdown body.
  if (resource.body) {
    const lines = resource.body.split("\n").filter(Boolean);
    return (
      <div className="rounded-lg border p-5 max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
        {lines.map((line, i) => {
          if (line.startsWith("## ")) return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h3>;
          if (line.startsWith("# ")) return <h2 key={i} className="text-xl font-bold mb-3">{line.slice(2)}</h2>;
          if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
          return <p key={i} className="leading-relaxed mb-2 text-foreground/90">{line}</p>;
        })}
      </div>
    );
  }

  // 3) External link.
  if (resource.externalUrl) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-center">
        <ExternalLink className="size-8 mx-auto opacity-40 mb-2 text-muted-foreground" />
        <p className="text-muted-foreground mb-3">{t("doc.external")}</p>
        <Button asChild variant="outline">
          <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4 mr-1.5" /> {t("doc.openDocument")}
          </a>
        </Button>
      </div>
    );
  }

  // 4) Notice-only.
  return (
    <div className="rounded-lg border p-4 text-sm text-muted-foreground italic">
      {t("doc.noDocument")}
    </div>
  );
}
