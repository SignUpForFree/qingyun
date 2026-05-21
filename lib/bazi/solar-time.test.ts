import { describe, it, expect } from "vitest";
import { toSolarTrueTime } from "./solar-time";

describe("toSolarTrueTime", () => {
  it("标准经度 120° + EoT 偏差等于 EoT 值", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 120);
    // 经度修正=0，只有 EoT ≈ -0.19 分钟
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    expect(diffMin).toBeCloseTo(-0.19, 1);
  });

  it("杭州 lng=120.1551 经度修正+EoT", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 120.1551);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    // 经度修正 0.6204 + EoT(-0.19) ≈ 0.43
    expect(diffMin).toBeCloseTo(0.43, 1);
  });

  it("上海 lng=121.4737 经度修正+EoT", () => {
    const t = new Date("2000-01-01T06:00:00+08:00");
    const result = toSolarTrueTime(t, 121.4737);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    // 经度修正 5.8948 + EoT(-3.71) ≈ 2.19
    expect(diffMin).toBeCloseTo(2.19, 1);
  });

  it("北京 lng=116.4074 经度修正+EoT", () => {
    const t = new Date("1985-12-31T23:45:00+08:00");
    const result = toSolarTrueTime(t, 116.4074);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    // 经度修正 -14.37 + EoT(-3.26) ≈ -17.63
    expect(diffMin).toBeCloseTo(-17.63, 1);
  });

  it("乌鲁木齐 lng=87.6 经度修正+EoT", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const result = toSolarTrueTime(t, 87.6);
    const diffMin = (result.getTime() - t.getTime()) / 60_000;
    // 经度修正 -129.6 + EoT(-0.19) ≈ -129.8
    expect(diffMin).toBeCloseTo(-129.8, 0);
  });

  it("不修改输入 Date (immutable)", () => {
    const t = new Date("1990-06-15T14:30:00+08:00");
    const originalIso = t.toISOString();
    toSolarTrueTime(t, 87.6);
    expect(t.toISOString()).toBe(originalIso);
  });
});