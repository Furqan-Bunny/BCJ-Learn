// Single source of truth for the BCJ Markets list (formerly "Cohorts"). One
// employee can belong to one or more markets at the same time. Imported by the
// admin "Add employee" / bulk-import / filter UI so that adding a market is a
// one-line change.

export const MARKETS = ["Atlanta", "Dallas", "Phoenix"] as const;
export type Market = (typeof MARKETS)[number];

/** Normalise free-form text (e.g. from a CSV cell) to a canonical Market. */
export function normaliseMarket(raw: string): Market | null {
  const t = raw.trim();
  return (MARKETS as readonly string[]).includes(t) ? (t as Market) : null;
}

/** Parse a CSV cell like "Atlanta;Dallas" into a unique list of markets. */
export function parseMarketsCell(cell: string): Market[] {
  return Array.from(
    new Set(
      cell
        .split(/[;,]/)
        .map((s) => normaliseMarket(s))
        .filter((m): m is Market => !!m),
    ),
  );
}

/** Format a list of markets for display ("Atlanta · Dallas"). */
export function fmtMarkets(markets: string[] | null | undefined): string {
  if (!markets || markets.length === 0) return "—";
  return markets.join(" · ");
}
