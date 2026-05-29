"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/shared/animations";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; suffix?: string }; // e.g., +12% vs last month
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "default" | "gold" | "success" | "warning" | "ai";
  /** When the value is numeric and matches /^[\d.,%$]+$/, it animates as a count-up. */
  animate?: boolean;
  /** Make the card a clickable Link — drills down into the related details. */
  href?: string;
}

const ACCENT_CLASSES = {
  default: "text-primary",
  gold: "text-[var(--gold)]",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  ai: "text-violet-600 dark:text-violet-400",
} as const;

export function KpiCard({ label, value, delta, icon: Icon, accent = "default", animate = true, href }: KpiCardProps) {
  const positive = delta && delta.value > 0;
  const negative = delta && delta.value < 0;
  const neutral = delta && delta.value === 0;
  const Trend = positive ? TrendingUp : negative ? TrendingDown : Minus;

  // Parse the value for count-up animation: extract leading numeric portion + non-numeric suffix.
  const parsed = React.useMemo(() => {
    if (!animate) return null;
    if (typeof value === "number") return { num: value, prefix: "", suffix: "" };
    const m = String(value).match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return null;
    const num = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(num)) return null;
    return { num, prefix: m[1], suffix: m[3] };
  }, [value, animate]);

  const card = (
    <Card className={cn(
      "overflow-hidden card-lift",
      href && "cursor-pointer group",
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {Icon && (
            <div className={cn("flex items-center justify-center size-8 rounded-md bg-muted transition-colors", ACCENT_CLASSES[accent])}>
              <Icon className="size-4" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-3xl font-bold tracking-tight tabular-nums">
            {parsed ? (
              <CountUp
                value={parsed.num}
                prefix={parsed.prefix}
                suffix={parsed.suffix}
                decimals={Number.isInteger(parsed.num) ? 0 : 1}
              />
            ) : (
              value
            )}
          </div>
        </div>
        {delta && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              positive && "text-emerald-600 dark:text-emerald-400",
              negative && "text-rose-600 dark:text-rose-400",
              neutral && "text-muted-foreground",
            )}
          >
            <Trend className="size-3" />
            <span>{positive && "+"}{delta.value}{delta.suffix ?? "%"}</span>
            <span className="text-muted-foreground font-normal">vs last month</span>
          </div>
        )}
        {href && (
          <div className="mt-3 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            View details <ArrowUpRight className="size-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href} className="block">{card}</Link> : card;
}
