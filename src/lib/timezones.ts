// Curated time-zone list for scheduling seminars. Stored as the IANA `value`;
// `abbr` is shown next to the time so everyone sees an unambiguous moment.
// BCJ is US-based, so the common US zones + UTC/GMT cover the need.

export interface TzOption {
  value: string;
  label: string;
  abbr: string;
}

export const TIMEZONES: TzOption[] = [
  { value: "America/New_York", label: "Eastern Time (ET)", abbr: "ET" },
  { value: "America/Chicago", label: "Central Time (CT)", abbr: "CT" },
  { value: "America/Denver", label: "Mountain Time (MT)", abbr: "MT" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", abbr: "PT" },
  { value: "UTC", label: "UTC", abbr: "UTC" },
  { value: "Etc/GMT", label: "GMT", abbr: "GMT" },
];

/** Short label to show beside a time (falls back to the raw value). */
export function tzAbbr(value: string | null | undefined): string {
  if (!value) return "";
  return TIMEZONES.find((t) => t.value === value)?.abbr ?? value;
}

/** The admin's device zone if it's one we offer, else Eastern as a sensible default. */
export function defaultTimezone(): string {
  try {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (device && TIMEZONES.some((t) => t.value === device)) return device;
  } catch {
    /* ignore */
  }
  return "America/New_York";
}
