import { describe, expect, it } from "vitest";
import { monthOptions, reportPeriodRange, yearOptions } from "./reportPeriod";

const now = new Date(2026, 10, 4, 15, 30); // 04/11/2026

describe("reportPeriodRange", () => {
  it("uses the chosen month, not only the current one", () => {
    const { since, until } = reportPeriodRange("month", { monthKey: "2026-08", now });
    expect(since).toEqual(new Date(2026, 7, 1));
    expect(until).toEqual(new Date(2026, 8, 1));
  });

  it("defaults to the current month and handles December → January", () => {
    expect(reportPeriodRange("month", { now }).since).toEqual(new Date(2026, 10, 1));
    expect(reportPeriodRange("month", { monthKey: "2026-12", now }).until).toEqual(new Date(2027, 0, 1));
  });

  it("covers the whole chosen year", () => {
    const { since, until } = reportPeriodRange("year", { year: 2027, now });
    expect(since).toEqual(new Date(2027, 0, 1));
    expect(until).toEqual(new Date(2028, 0, 1));
  });

  it("starts the week on Monday and leaves 'all' open", () => {
    expect(reportPeriodRange("week", { now }).since).toEqual(new Date(2026, 10, 2));
    expect(reportPeriodRange("all", { now })).toEqual({ since: null, until: null });
  });
});

describe("month and year options", () => {
  it("lists months from the first record to now, newest first", () => {
    const opts = monthOptions(new Date(2026, 7, 20), now);
    expect(opts.map((o) => o.key)).toEqual(["2026-11", "2026-10", "2026-09", "2026-08"]);
    expect(opts[3].label).toBe("Agosto de 2026");
  });

  it("falls back to the current month/year without records", () => {
    expect(monthOptions(null, now).map((o) => o.key)).toEqual(["2026-11"]);
    expect(yearOptions(null, now)).toEqual([2026]);
    expect(yearOptions(new Date(2026, 7, 1), new Date(2027, 1, 1))).toEqual([2027, 2026]);
  });
});
