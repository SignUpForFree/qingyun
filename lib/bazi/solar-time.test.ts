import { describe, it, expect } from "vitest";
import { toSolarTrueTime } from "./solar-time";

describe("toSolarTrueTime", () => {
  it("标准经度 120° (东八区中心) 偏差为 0", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 120);
    expect(result.toISOString()).toBe(t.toISOString());
  });

  it("杭州 lng=120.1551 偏差约 +0.62 分钟", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 120.1551);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(0.6204, 3);
  });

  it("上海 lng=121.4737 偏差约 +5.89 分钟", () => {
    const t = new Date("2000-01-01T06:00:00+08:00");
    const result = toSolarTrueTime(t, 121.4737);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(5.8948, 3);
  });

  it("北京 lng=116.4074 偏差约 -14.37 分钟", () => {
    const t = new Date("1985-12-31T23:45:00+08:00");
    const result = toSolarTrueTime(t, 116.4074);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(-14.37, 1);
  });

  it("乌鲁木齐 lng=87.6 偏差约 -129.6 分钟", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 87.6);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(-129.6, 0);
  });

  it("不修改输入 Date (immutable)", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const originalIso = t.toISOString();
    toSolarTrueTime(t, 87.6);
    expect(t.toISOString()).toBe(originalIso);
  });
});
