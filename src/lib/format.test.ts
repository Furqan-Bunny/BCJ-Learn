import { describe, it, expect } from "vitest";
import { fmtDate, toLocalDate } from "@/lib/format";

describe("fmtDate / toLocalDate", () => {
  it("renders a date-only string on the same calendar day (no UTC back-shift)", () => {
    // The classic bug: new Date('2026-06-18') is UTC midnight, which renders as
    // Jun 17 in a US (negative-offset) timezone. toLocalDate parses it as LOCAL
    // midnight so it always reads the 18th.
    expect(fmtDate("2026-06-18")).toBe("Jun 18, 2026");
  });

  it("keeps the day for a date-only string regardless of pattern", () => {
    expect(fmtDate("2026-01-01", "yyyy-MM-dd")).toBe("2026-01-01");
    expect(fmtDate("2026-12-31", "MMM d")).toBe("Dec 31");
  });

  it("toLocalDate parses date-only parts as local midnight", () => {
    const d = toLocalDate("2026-06-18");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(0);
  });

  it("leaves full ISO timestamps to the native parser", () => {
    const iso = "2026-06-18T15:30:00.000Z";
    expect(toLocalDate(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it("returns an em dash for nullish input", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
  });
});
