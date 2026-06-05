"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Award } from "lucide-react";
import { fmtDate } from "@/lib/format";

export function CertificateView({
  name,
  moduleTitle,
  moduleNumber,
  scorePct,
  passedAt,
  moduleSlug,
}: {
  name: string;
  moduleTitle: string;
  moduleNumber: number;
  scorePct: number;
  passedAt: string;
  moduleSlug: string;
}) {
  return (
    <>
      {/* Screen-only toolbar — hidden when printing. */}
      <div className="print:hidden flex items-center justify-between mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/manager/modules/${moduleSlug}`}><ArrowLeft className="size-4 mr-1" /> Back to module</Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4 mr-1.5" /> Print / Save as PDF
        </Button>
      </div>

      {/* The certificate. Centered on screen; fills the page when printed. */}
      <div className="mx-auto max-w-3xl">
        <div className="certificate relative bg-white text-[#041D39] rounded-lg overflow-hidden border-8 border-double border-[#041D39] p-10 md:p-14 text-center shadow-sm">
          {/* gold accent rule */}
          <div className="absolute inset-x-0 top-0 h-2 bg-[#12D7CD]" />

          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="size-10 rounded-md bg-[#041D39] text-white flex items-center justify-center">
              <Award className="size-5" />
            </div>
            <div className="text-lg font-bold tracking-tight">BCJ Building Services</div>
          </div>

          <div className="text-xs uppercase tracking-[0.3em] text-[#041D39]/60">Certificate of Completion</div>

          <p className="mt-8 text-sm text-[#041D39]/70">This certifies that</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{name}</h1>

          <p className="mt-6 text-sm text-[#041D39]/70">has successfully completed</p>
          <h2 className="mt-2 text-xl md:text-2xl font-semibold">
            Module {moduleNumber}: {moduleTitle}
          </h2>

          <div className="mt-8 inline-flex items-center gap-6 rounded-lg bg-[#041D39]/[0.04] px-6 py-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#041D39]/60">Score</div>
              <div className="text-2xl font-bold tabular-nums">{scorePct}%</div>
            </div>
            <div className="h-8 w-px bg-[#041D39]/15" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#041D39]/60">Completed</div>
              <div className="text-2xl font-bold">{fmtDate(passedAt)}</div>
            </div>
          </div>

          <div className="mt-12 flex items-end justify-between gap-6">
            <div className="flex-1 text-left">
              <div className="h-px bg-[#041D39]/30 mb-1" />
              <div className="text-[11px] text-[#041D39]/60">BCJ Learn — Training Platform</div>
            </div>
            <div className="size-16 rounded-full border-2 border-[#12D7CD] flex items-center justify-center text-[#12D7CD] shrink-0">
              <Award className="size-8" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
