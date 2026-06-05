"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Award } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { CertificateSettings } from "@/lib/db/settings";

/** Substitute {{name}} {{module}} {{score}} {{date}} in any template string. */
function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function CertificateView({
  name,
  moduleTitle,
  moduleNumber,
  scorePct,
  passedAt,
  moduleSlug,
  settings,
  logoUrl,
}: {
  name: string;
  moduleTitle: string;
  moduleNumber: number;
  scorePct: number;
  passedAt: string;
  moduleSlug: string;
  settings: CertificateSettings;
  logoUrl: string;
}) {
  const [logoOk, setLogoOk] = React.useState(true);

  const vars = {
    name,
    module: `Module ${moduleNumber}: ${moduleTitle}`,
    score: `${scorePct}%`,
    date: fmtDate(passedAt),
  };

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

      <div className="mx-auto max-w-3xl">
        <div className="certificate printable relative bg-white text-[#041D39] rounded-lg overflow-hidden border-8 border-double border-[#041D39] p-10 md:p-14 text-center shadow-sm">
          <div className="absolute inset-x-0 top-0 h-2 bg-[#12D7CD]" />

          {settings.showLogo && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {logoOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={settings.orgName} onError={() => setLogoOk(false)} className="h-12 w-auto object-contain" />
              ) : (
                <>
                  <div className="size-10 rounded-md bg-[#041D39] text-white flex items-center justify-center">
                    <Award className="size-5" />
                  </div>
                  <div className="text-lg font-bold tracking-tight">{settings.orgName}</div>
                </>
              )}
            </div>
          )}

          <div className="text-xs uppercase tracking-[0.3em] text-[#041D39]/60">{fill(settings.heading, vars)}</div>

          <p className="mt-8 text-sm text-[#041D39]/70">{fill(settings.introLine, vars)}</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{name}</h1>

          <p className="mt-6 text-sm text-[#041D39]/70">{fill(settings.completionLine, vars)}</p>
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
              {settings.signatoryName ? (
                <>
                  <div className="text-sm font-semibold">{settings.signatoryName}</div>
                  {settings.signatoryTitle && <div className="text-[11px] text-[#041D39]/60">{settings.signatoryTitle}</div>}
                </>
              ) : (
                <div className="text-[11px] text-[#041D39]/60">{fill(settings.footer, vars)}</div>
              )}
            </div>
            <div className="size-16 rounded-full border-2 border-[#12D7CD] flex items-center justify-center text-[#12D7CD] shrink-0">
              <Award className="size-8" />
            </div>
          </div>

          {settings.signatoryName && (
            <div className="mt-6 text-[11px] text-[#041D39]/50">{fill(settings.footer, vars)}</div>
          )}
        </div>
      </div>
    </>
  );
}
