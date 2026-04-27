import { describe, it, expect } from "vitest";
import { getLunarToday } from "./lunar-date";

describe("getLunarToday", () => {
  it("2026-04-28 中午 → 丙午年 · 三月十二（无节气）", () => {
    const r = getLunarToday(new Date("2026-04-28T04:00:00Z")); // = UTC+8 12:00
    expect(r.ganzhiYear).toBe("丙午年");
    expect(r.lunarMonthDay).toBe("三月十二");
    expect(r.jieqi).toBe("");
    expect(r.headerText).toBe("丙午年 · 三月十二");
    expect(r.greeting).toBe("午安");
  });

  it("2026-04-20 谷雨日 → header 含节气", () => {
    const r = getLunarToday(new Date("2026-04-20T04:00:00Z")); // 谷雨 2026-04-20
    expect(r.jieqi).toBe("谷雨");
    expect(r.headerText).toContain("谷雨");
  });

  it("时辰问候按当前时分", () => {
    const cases: Array<[string, ReturnType<typeof getLunarToday>["greeting"]]> = [
      ["2026-04-28T22:00:00Z", "清晨好"], // UTC+8 06:00
      ["2026-04-28T01:00:00Z", "上午好"], // UTC+8 09:00
      ["2026-04-28T04:00:00Z", "午安"], // 12:00
      ["2026-04-28T07:00:00Z", "下午好"], // 15:00
      ["2026-04-28T11:00:00Z", "晚上好"], // 19:00
      ["2026-04-28T17:00:00Z", "夜深了"], // 01:00 次日
    ];
    for (const [iso, want] of cases) {
      expect(getLunarToday(new Date(iso)).greeting).toBe(want);
    }
  });
});
