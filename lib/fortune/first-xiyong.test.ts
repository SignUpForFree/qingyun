import { describe, it, expect } from "vitest";
import { computeFirstXiyong, computeDayXiyongMatch } from "./first-xiyong";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";
import { wuxingOf } from "@/lib/bazi/stems-branches";
import type { Stem, Branch, Wuxing } from "@/lib/bazi/stems-branches";

const testChart = buildChartV2({
  birthTime: new Date("1990-06-15T14:30:00+08:00"),
  longitude: 120.1551,
  latitude: 30.2741,
  gender: "male",
  calendarType: "solar",
});

describe("computeFirstXiyong（第一喜用神五行判定）", () => {
  it("返回有效五行", () => {
    const r = computeFirstXiyong(testChart);
    expect(["金", "木", "水", "火", "土"]).toContain(r.wuxing);
  });

  it("第一喜用神属于喜用神方向", () => {
    const r = computeFirstXiyong(testChart);
    expect(testChart.yongShenFull.xiyongshen).toContain(r.wuxing);
  });

  it("各候选五行综合得分 0-100", () => {
    const r = computeFirstXiyong(testChart);
    for (const wx of ["金", "木", "水", "火", "土"] as Wuxing[]) {
      expect(r.scores[wx]).toBeGreaterThanOrEqual(0);
      expect(r.scores[wx]).toBeLessThanOrEqual(100);
    }
  });

  it("忌神方向五行得分为 0（能量平衡分=0 × 0.7 + 通关调候分=0 × 0.3 = 0）", () => {
    const r = computeFirstXiyong(testChart);
    for (const ji of testChart.yongShenFull.jishen) {
      // 忌神的通关调候分=0，能量平衡分=0，所以综合得分应为0
      expect(r.scores[ji]).toBe(0);
    }
  });

  it("喜用神方向五行综合得分 > 忌神方向", () => {
    const r = computeFirstXiyong(testChart);
    const xiMin = Math.min(...testChart.yongShenFull.xiyongshen.map((wx) => r.scores[wx as Wuxing]));
    const jiMax = Math.max(...testChart.yongShenFull.jishen.map((wx) => r.scores[wx as Wuxing] ?? 0));
    expect(xiMin).toBeGreaterThanOrEqual(jiMax);
  });

  it("调候用神优先：若存在，第一喜用神是调候用神之一", () => {
    if (testChart.yongShenFull.tiaohou_shen.length > 0) {
      const r = computeFirstXiyong(testChart);
      expect(testChart.yongShenFull.tiaohou_shen).toContain(r.wuxing);
    }
  });
});

describe("computeDayXiyongMatch（当日喜用神匹配度）", () => {
  it("返回有效五行和匹配度", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDayXiyongMatch(testChart, day.gan as Stem, day.zhi as Branch);
    expect(["金", "木", "水", "火", "土"]).toContain(r.wuxing);
    expect(r.matchScore).toBeTypeOf("number");
  });

  it("匹配度只能是 0 / 10 / 20 / 25", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDayXiyongMatch(testChart, day.gan as Stem, day.zhi as Branch);
    expect([0, 10, 20, 25]).toContain(r.matchScore);
  });

  it("天干∈喜用神 → matchScore >= 10", () => {
    const xiyongshen = testChart.yongShenFull.xiyongshen;
    const allStems: Stem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const matchGan = allStems.find((s) => xiyongshen.includes(wuxingOf(s)));
    if (matchGan) {
      const r = computeDayXiyongMatch(testChart, matchGan, "子" as Branch);
      expect(r.matchScore).toBeGreaterThanOrEqual(10);
    }
  });

  it("天干地支都不属于喜用神 → 匹配度 0，取原局第一喜用神", () => {
    const xiyongshen = testChart.yongShenFull.xiyongshen;
    const allStems: Stem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const allBranches: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

    const badGan = allStems.find((s) => !xiyongshen.includes(wuxingOf(s)));
    const badZhi = allBranches.find((z) => !xiyongshen.includes(wuxingOf(z)));

    if (badGan && badZhi) {
      const r = computeDayXiyongMatch(testChart, badGan, badZhi);
      expect(r.matchScore).toBe(0);
      const firstXiyong = computeFirstXiyong(testChart).wuxing;
      expect(r.wuxing).toBe(firstXiyong);
    }
  });

  it("天干地支五行相同且都属于喜用神 → 额外+5（总分25）", () => {
    const xiyongshen = testChart.yongShenFull.xiyongshen;
    const allStems: Stem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const allBranches: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

    for (const gan of allStems) {
      const ganWx = wuxingOf(gan);
      if (!xiyongshen.includes(ganWx)) continue;
      for (const zhi of allBranches) {
        const zhiWx = wuxingOf(zhi);
        if (ganWx === zhiWx && xiyongshen.includes(zhiWx)) {
          const r = computeDayXiyongMatch(testChart, gan, zhi);
          expect(r.matchScore).toBe(25);
          return;
        }
      }
    }
  });
});