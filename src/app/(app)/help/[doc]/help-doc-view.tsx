"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

export function HelpDocView({ title, html }: { title: string; html: string }) {
  return (
    <>
      {/* Toolbar — hidden when printing. */}
      <div className="print:hidden flex items-center justify-between mb-6 gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/help"><ArrowLeft className="size-4 mr-1" /> All guides</Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4 mr-1.5" /> Print / Save as PDF
        </Button>
      </div>

      {/* The .printable container is the only thing that prints (see globals.css). */}
      <article
        className="printable prose prose-sm md:prose-base dark:prose-invert max-w-3xl mx-auto"
        // Content comes from our own trusted Markdown files in /docs.
        dangerouslySetInnerHTML={{ __html: html }}
        aria-label={title}
      />
    </>
  );
}
