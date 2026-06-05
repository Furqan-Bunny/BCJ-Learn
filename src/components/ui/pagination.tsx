"use client";

// Reusable pagination bar for client-side paginated lists/cards.
//
//   const PER = 12;
//   const [page, setPage] = React.useState(0);            // 0-based
//   const shown = pageSlice(items, page, PER);
//   ...
//   <Pagination page={page} total={items.length} pageSize={PER} onPageChange={setPage} />
//
// Reset to page 0 whenever the filtered set changes (e.g. in a useEffect on
// the filter inputs) so the user never lands on an empty page.

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Slice an array for the given 0-based page. */
export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice(page * pageSize, page * pageSize + pageSize);
}

/** Windowed page numbers with ellipsis: 1 … 4 [5] 6 … 20 */
function pageWindow(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const out: (number | "…")[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(count - 2, current + 1);
  if (start > 1) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 2) out.push("…");
  out.push(count - 1);
  return out;
}

export interface PaginationProps {
  /** 0-based current page. */
  page: number;
  /** Total number of items across all pages. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Hide the "X–Y of Z" summary on the left. */
  hideSummary?: boolean;
}

export function Pagination({ page, total, pageSize, onPageChange, className, hideSummary }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, page * pageSize + pageSize);
  const go = (p: number) => onPageChange(Math.min(pageCount - 1, Math.max(0, p)));

  return (
    <div className={cn("flex items-center justify-between gap-3 flex-wrap pt-2", className)}>
      {!hideSummary ? (
        <div className="text-xs text-muted-foreground tabular-nums">
          {from}–{to} of {total}
        </div>
      ) : <span />}

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => go(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pageWindow(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-muted-foreground text-sm select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon"
              className="size-8 tabular-nums"
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p + 1}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => go(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
