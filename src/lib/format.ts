// Tiny formatting helpers used across the app.

import { format, formatDistanceToNow } from "date-fns";
import { tzAbbr } from "@/lib/timezones";

/**
 * Parse a value to a Date for display. A bare date-only string ("YYYY-MM-DD",
 * e.g. a scheduled training day) is parsed as LOCAL midnight — `new Date("…")`
 * would treat it as UTC midnight, which shifts the day BACK by one in any
 * negative-offset (US) timezone (entered the 18th, showed the 17th). Full ISO
 * timestamps (with a "T…") and Date objects are left to the native parser.
 */
export function toLocalDate(iso: string | Date): Date {
  if (iso instanceof Date) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

export function fmtDate(iso: string | Date | null | undefined, pattern = "MMM d, yyyy") {
  if (!iso) return "—";
  return format(toLocalDate(iso), pattern);
}

export function fmtRelative(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return formatDistanceToNow(toLocalDate(iso), { addSuffix: true });
}

/** Format a 24h "HH:MM[:SS]" time string (from an <input type="time">) as "h:mm a". */
export function fmtTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hour = Number(h);
  const min = Number(m);
  if (Number.isNaN(hour) || Number.isNaN(min)) return null;
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

/** "MMM d, yyyy · h:mm a" when a time is present; date only otherwise. */
export function fmtDateTime(iso: string | Date | null | undefined, time?: string | null): string {
  const date = fmtDate(iso);
  const t = fmtTime(time);
  return t ? `${date} · ${t}` : date;
}

/** "h:mm a ET" — time with its zone abbreviation; null when no time. */
export function fmtTimeWithZone(time: string | null | undefined, tz?: string | null): string | null {
  const t = fmtTime(time);
  if (!t) return null;
  const abbr = tzAbbr(tz);
  return abbr ? `${t} ${abbr}` : t;
}

export function fmtDuration(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export function fmtPct(num: number | null | undefined, decimals = 0) {
  if (num == null) return "—";
  return `${num.toFixed(decimals)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
