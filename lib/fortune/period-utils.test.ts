import { describe, it, expect } from "vitest";
import {
  addCalendarDaysIso,
  mondayOfWeekContaining,
  datesInWeekFromMonday,
  monthKeyFromIso,
  datesInCalendarMonth,
  formatWeekRangeCn,
  weekdayMonday0,
} from "./period-utils";

describe("period-utils", () => {
  it("addCalendarDaysIso", () => {
    expect(addCalendarDaysIso("2026-05-04", 1)).toBe("2026-05-05");
    expect(addCalendarDaysIso("2026-05-04", -1)).toBe("2026-05-03");
  });

  it("weekdayMonday0: 2026-05-04 is Monday -> 0", () => {
    expect(weekdayMonday0("2026-05-04")).toBe(0);
  });

  it("mondayOfWeekContaining returns Monday of same week", () => {
    expect(mondayOfWeekContaining("2026-05-04")).toBe("2026-05-04");
    expect(mondayOfWeekContaining("2026-05-10")).toBe("2026-05-04");
  });

  it("datesInWeekFromMonday has 7 consecutive days", () => {
    const d = datesInWeekFromMonday("2026-05-04");
    expect(d).toHaveLength(7);
    expect(d[0]).toBe("2026-05-04");
    expect(d[6]).toBe("2026-05-10");
  });

  it("monthKeyFromIso", () => {
    expect(monthKeyFromIso("2026-05-04")).toBe("2026-05");
  });

  it("datesInCalendarMonth length matches calendar", () => {
    expect(datesInCalendarMonth("2026-02")).toHaveLength(28);
    expect(datesInCalendarMonth("2024-02")).toHaveLength(29);
    expect(datesInCalendarMonth("2026-05")).toHaveLength(31);
  });

  it("formatWeekRangeCn", () => {
    expect(formatWeekRangeCn("2026-05-04")).toBe("5/4–5/10");
  });
});
