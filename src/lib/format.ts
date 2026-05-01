// Tiny formatting helpers used across the app.

import { format, formatDistanceToNow } from "date-fns";

export function fmtDate(iso: string | Date | null | undefined, pattern = "MMM d, yyyy") {
  if (!iso) return "—";
  return format(new Date(iso), pattern);
}

export function fmtRelative(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
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
