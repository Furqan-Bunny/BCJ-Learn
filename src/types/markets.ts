// Single source of truth for the BCJ Markets list (formerly "Cohorts"). One
// employee can belong to one or more markets at the same time. Imported by the
// admin "Add employee" / bulk-import / filter UI so that adding a market is a
// one-line change.

// BCJ refers to its markets by their hub city (this is how the internal team
// talks about them), not the state. Legacy data used the state names, so
// normaliseMarket maps the old states/abbreviations onto the city.
export const MARKETS = ["Atlanta", "Nashville", "Charlotte"] as const;
export type Market = (typeof MARKETS)[number];

/** Old state names / abbreviations → the canonical hub city. */
const MARKET_ALIASES: Record<string, Market> = {
  georgia: "Atlanta",
  ga: "Atlanta",
  tennessee: "Nashville",
  tn: "Nashville",
  "north carolina": "Charlotte",
  nc: "Charlotte",
};

/** Normalise free-form text (e.g. from a CSV cell) to a canonical Market. */
export function normaliseMarket(raw: string): Market | null {
  const t = raw.trim();
  const exact = (MARKETS as readonly string[]).find((m) => m.toLowerCase() === t.toLowerCase());
  if (exact) return exact as Market;
  return MARKET_ALIASES[t.toLowerCase()] ?? null;
}

/** Parse a CSV cell like "Georgia;Tennessee" into a unique list of markets. */
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

/** Format a list of markets for display ("Georgia · Tennessee"). */
export function fmtMarkets(markets: string[] | null | undefined): string {
  if (!markets || markets.length === 0) return "—";
  return markets.join(" · ");
}
