import { describe, it, expect } from "vitest";
import {
  buildSolarDatePickerValue,
  buildLunarDatePickerValue,
} from "./DatePicker";

describe("buildSolarDatePickerValue", () => {
  it("公历 1990-06-15 14 时", () => {
    const v = buildSolarDatePickerValue(1990, 6, 15, 14);
    expect(v.calendarType).toBe("solar");
    expect(v.solarDate).toBe("1990-06-15");
    expect(v.hour).toBe(14);
    expect(v.rawDate).toEqual({ year: 1990, month: 6, day: 15 });
  });

  it("hour 默认 null（用户未选时辰）", () => {
    const v = buildSolarDatePickerValue(2000, 1, 1);
    expect(v.hour).toBeNull();
  });

  it("月日 padStart 补 0", () => {
    const v = buildSolarDatePickerValue(2024, 3, 5);
    expect(v.solarDate).toBe("2024-03-05");
  });
});

describe("buildLunarDatePickerValue", () => {
  it("农历 2000 春节 (正月初一) → 公历 2000-02-05", () => {
    const v = buildLunarDatePickerValue(2000, 1, 1);
    expect(v.calendarType).toBe("lunar");
    expect(v.solarDate).toBe("2000-02-05");
    expect(v.rawDate).toEqual({ year: 2000, month: 1, day: 1 });
  });

  it("农历值保留在 rawDate 中, solarDate 是换算后的公历", () => {
    const v = buildLunarDatePickerValue(1990, 5, 22, 14);
    expect(v.rawDate.year).toBe(1990);
    expect(v.rawDate.month).toBe(5);
    expect(v.rawDate.day).toBe(22);
    expect(v.solarDate).not.toBe("1990-05-22"); // 应是换算后的公历
    expect(v.hour).toBe(14);
  });
});
