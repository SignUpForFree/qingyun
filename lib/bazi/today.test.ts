import { describe, it, expect } from "vitest";
import { getDayPillar } from "./today";
import { TEN_STEMS, TWELVE_BRANCHES } from "./stems-branches";

describe("getDayPillar", () => {
  it("返回 UTC+8 日期 + 合法干支", () => {
    const p = getDayPillar(new Date("2026-04-26T05:00:00Z")); // UTC+8 = 2026-04-26 13:00
    expect(p.date).toBe("2026-04-26");
    expect(TEN_STEMS).toContain(p.gan);
    expect(TWELVE_BRANCHES).toContain(p.zhi);
  });

  it("UTC 跨日边界按 UTC+8 校正", () => {
    // UTC 2026-04-25 17:00 = UTC+8 2026-04-26 01:00
    const p = getDayPillar(new Date("2026-04-25T17:00:00Z"));
    expect(p.date).toBe("2026-04-26");
  });

  it("默认参数 = 当前时刻", () => {
    const p = getDayPillar();
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("同一天多次调用返回同一日柱", () => {
    const morning = getDayPillar(new Date("2026-04-26T01:00:00+08:00"));
    const evening = getDayPillar(new Date("2026-04-26T22:00:00+08:00"));
    expect(morning).toEqual(evening);
  });
});
