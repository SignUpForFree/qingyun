import { describe, it, expect } from "vitest";
import { buildTempChart, buildOriginTempChart, buildDayunTempChart } from "./temp-chart";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";
import type { Stem, Branch, Wuxing } from "@/lib/bazi/stems-branches";

const testChart = buildChartV2({
  birthTime: new Date("1990-06-15T14:30:00+08:00"),
  longitude: 120.1551,
  latitude: 30.2741,
  gender: "male",
  calendarType: "solar",
});

const testDay = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));

function makeTempChartArgs() {
  const currentDayun = testChart.dayunWithFortune?.[0];
  return {
    pillars: testChart.pillars,
    monthZhi: testChart.pillars.month.zhi as Branch,
    dayunStem: (currentDayun?.stem ?? testChart.pillars.month.gan) as Stem,
    dayunBranch: (currentDayun?.branch ?? testChart.pillars.month.zhi) as Branch,
    dayGan: testDay.gan as Stem,
    dayZhi: testDay.zhi as Branch,
    strengthType: testChart.strength.strength_type,
    xiyongshen: testChart.yongShenFull.xiyongshen as Wuxing[],
    jishen: testChart.yongShenFull.jishen as Wuxing[],
  };
}

describe("buildTempChart（6步临时命局）", () => {
  it("返回所有必需字段", () => {
    const r = buildTempChart(makeTempChartArgs());
    expect(r.finalScores).toBeDefined();
    expect(r.tenGodsEnergy).toBeDefined();
    expect(r.bangfuTotal).toBeTypeOf("number");
    expect(r.kexiehaoTotal).toBeTypeOf("number");
    expect(r.fortuneLevel).toBeTruthy();
    expect(r.fortuneLevelScore).toBeTypeOf("number");
    expect(r.favorableMultiplier).toBeTypeOf("number");
    expect(r.xchhMatches).toBeDefined();
  });

  it("五行能量分 finalScores 非负", () => {
    const r = buildTempChart(makeTempChartArgs());
    for (const wx of ["金", "木", "水", "火", "土"] as Wuxing[]) {
      expect(r.finalScores[wx]).toBeGreaterThanOrEqual(0);
    }
  });

  it("十神能量分 0-100 且总和 ≈ 100", () => {
    const r = buildTempChart(makeTempChartArgs());
    const gods = Object.values(r.tenGodsEnergy);
    const total = gods.reduce((s, v) => s + v, 0);
    for (const v of gods) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    // 总和应接近100（四舍五入可能有微小偏差）
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  it("旺衰等级映射分在 0-100 范围", () => {
    const r = buildTempChart(makeTempChartArgs());
    expect(r.fortuneLevelScore).toBeGreaterThanOrEqual(0);
    expect(r.fortuneLevelScore).toBeLessThanOrEqual(100);
  });

  it("喜忌修正系数为 0.9 / 1.0 / 1.1", () => {
    const r = buildTempChart(makeTempChartArgs());
    expect([0.9, 1.0, 1.1]).toContain(r.favorableMultiplier);
  });

  it("旺衰等级是五个等级之一", () => {
    const r = buildTempChart(makeTempChartArgs());
    expect(["大吉", "吉", "平", "凶", "大凶"]).toContain(r.fortuneLevel);
  });

  it("帮扶 + 克泄耗 > 0", () => {
    const r = buildTempChart(makeTempChartArgs());
    expect(r.bangfuTotal + r.kexiehaoTotal).toBeGreaterThan(0);
  });
});

describe("buildOriginTempChart（原局十神能量）", () => {
  it("返回 tenGodsEnergy 和 finalScores", () => {
    const r = buildOriginTempChart(
      testChart.pillars,
      testChart.pillars.month.zhi as Branch,
      testChart.pillars.day.gan as Stem,
    );
    expect(r.tenGodsEnergy).toBeDefined();
    expect(r.finalScores).toBeDefined();
  });

  it("原局十神能量总和 ≈ 100", () => {
    const r = buildOriginTempChart(
      testChart.pillars,
      testChart.pillars.month.zhi as Branch,
      testChart.pillars.day.gan as Stem,
    );
    const total = Object.values(r.tenGodsEnergy).reduce((s, v) => s + v, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });
});

describe("buildDayunTempChart（原局+大运十神能量）", () => {
  it("返回 tenGodsEnergy 和 finalScores", () => {
    const currentDayun = testChart.dayunWithFortune?.[0];
    const r = buildDayunTempChart(
      testChart.pillars,
      testChart.pillars.month.zhi as Branch,
      testChart.pillars.day.gan as Stem,
      (currentDayun?.stem ?? testChart.pillars.month.gan) as Stem,
      (currentDayun?.branch ?? testChart.pillars.month.zhi) as Branch,
    );
    expect(r.tenGodsEnergy).toBeDefined();
    expect(r.finalScores).toBeDefined();
  });

  it("大运十神能量与原局不同（大运影响）", () => {
    const origin = buildOriginTempChart(
      testChart.pillars,
      testChart.pillars.month.zhi as Branch,
      testChart.pillars.day.gan as Stem,
    );
    const currentDayun = testChart.dayunWithFortune?.[0];
    const dayun = buildDayunTempChart(
      testChart.pillars,
      testChart.pillars.month.zhi as Branch,
      testChart.pillars.day.gan as Stem,
      (currentDayun?.stem ?? testChart.pillars.month.gan) as Stem,
      (currentDayun?.branch ?? testChart.pillars.month.zhi) as Branch,
    );
    // 至少有一个十神能量分不同
    const keys = Object.keys(origin.tenGodsEnergy) as (keyof typeof origin.tenGodsEnergy)[];
    const someDiff = keys.some((k) => origin.tenGodsEnergy[k] !== dayun.tenGodsEnergy[k]);
    expect(someDiff).toBe(true);
  });
});