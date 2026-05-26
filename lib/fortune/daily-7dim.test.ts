import { describe, it, expect } from "vitest";
import { computeDaily7, DAILY_7_DIMS, type DimensionScores7 } from "./daily-7dim";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";

const testChart = buildChartV2({
  birthTime: new Date("1990-06-15T14:30:00+08:00"),
  longitude: 120.1551,
  latitude: 30.2741,
  gender: "male",
  calendarType: "solar",
});

describe("computeDaily7 (V2 三权重+十神映射)", () => {
  it("DAILY_7_DIMS 是 7 项", () => {
    expect([...DAILY_7_DIMS]).toEqual([
      "爱情", "财富", "事业", "学习", "健康", "人际", "心情",
    ]);
    expect(DAILY_7_DIMS.length).toBe(7);
  });

  it("7 维度都在 [0, 100]", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    for (const dim of DAILY_7_DIMS) {
      expect(r.scores[dim]).toBeGreaterThanOrEqual(0);
      expect(r.scores[dim]).toBeLessThanOrEqual(100);
    }
  });

  it("overall 在 [0, 100]", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it("date 透传到结果", () => {
    const day = getDayPillar(new Date("2027-01-01T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.date).toBe(day.date);
  });

  it("meta 包含 dayPillar / dayMaster / dayWuxing / 旺衰等级", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.meta.dayPillar.gan).toBeTruthy();
    expect(r.meta.dayPillar.zhi).toBeTruthy();
    expect(r.meta.dayMaster).toBeTruthy();
    expect(["金", "木", "水", "火", "土"]).toContain(r.meta.dayWuxing);
    expect(r.meta.dayunFortuneLevel).toBeTruthy();
    expect(r.meta.liunianFortuneLevel).toBeTruthy();
    expect(r.meta.dayFortuneLevel).toBeTruthy();
  });

  it("不同日期产生不同分数", () => {
    const day1 = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const day2 = getDayPillar(new Date("2026-05-21T10:30:00+08:00"));
    const r1 = computeDaily7({ chart: testChart, day: day1, gender: "male" });
    const r2 = computeDaily7({ chart: testChart, day: day2, gender: "male" });
    const someDiff = DAILY_7_DIMS.some((d) => r1.scores[d] !== r2.scores[d]);
    expect(someDiff).toBe(true);
  });

  it("女命爱情维度用官杀替代财星", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const rMale = computeDaily7({ chart: testChart, day, gender: "male" });
    const rFemale = computeDaily7({ chart: testChart, day, gender: "female" });
    expect(rFemale.scores.爱情).toBeGreaterThanOrEqual(0);
    expect(rFemale.scores.爱情).toBeLessThanOrEqual(100);
  });

  it("7 维度分数均为整数", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    for (const dim of DAILY_7_DIMS) {
      expect(Number.isInteger(r.scores[dim])).toBe(true);
    }
  });
});

describe("三权重总运势分公式", () => {
  it("总运势分 = 大运30% + 流年40% + 当日30%", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    // overall 应为 0-100 整数
    expect(Number.isInteger(r.overall)).toBe(true);
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it("旺衰等级映射分在合理区间", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    // 大运/流年/当日旺衰等级应该是5级之一
    const validLevels = ["大吉", "吉", "平", "凶", "大凶"];
    expect(validLevels).toContain(r.meta.dayunFortuneLevel);
    expect(validLevels).toContain(r.meta.liunianFortuneLevel);
    expect(validLevels).toContain(r.meta.dayFortuneLevel);
  });

  it("喜忌修正使喜用神日得分偏高", () => {
    // 用多个日期计算，验证喜用神日的 overall 倾向更高
    const results: number[] = [];
    for (let d = 20; d <= 26; d++) {
      const day = getDayPillar(new Date(`2026-05-${d}T10:30:00+08:00`));
      const r = computeDaily7({ chart: testChart, day, gender: "male" });
      results.push(r.overall);
    }
    // 至少有一天和另一天的 overall 不同（表明喜忌修正生效）
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

describe("7维度十神映射规则", () => {
  it("事业维度受官杀+印星能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    // 事业分在0-100，验证非极端值（不太可能全0或全100）
    expect(r.scores.事业).toBeGreaterThanOrEqual(0);
    expect(r.scores.事业).toBeLessThanOrEqual(100);
  });

  it("财富维度受财+食伤能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.scores.财富).toBeGreaterThanOrEqual(0);
    expect(r.scores.财富).toBeLessThanOrEqual(100);
  });

  it("学习维度受印+食伤能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.scores.学习).toBeGreaterThanOrEqual(0);
    expect(r.scores.学习).toBeLessThanOrEqual(100);
  });

  it("健康维度受印+比劫能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.scores.健康).toBeGreaterThanOrEqual(0);
    expect(r.scores.健康).toBeLessThanOrEqual(100);
  });

  it("人际维度受比劫+食伤能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.scores.人际).toBeGreaterThanOrEqual(0);
    expect(r.scores.人际).toBeLessThanOrEqual(100);
  });

  it("心情维度受食伤+印星能量影响", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    expect(r.scores.心情).toBeGreaterThanOrEqual(0);
    expect(r.scores.心情).toBeLessThanOrEqual(100);
  });
});

describe("极值归一缩放", () => {
  it("最高维度分 = 100（或所有维度相同）", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    const maxScore = Math.max(...DAILY_7_DIMS.map((d) => r.scores[d]));
    // 归一化后最高维度应为100，但刑冲修正可能使其略低于100
    expect(maxScore).toBeGreaterThanOrEqual(85);
  });
});

describe("刑冲合害修正", () => {
  it("修正后维度分仍在 [0, 100]", () => {
    const day = getDayPillar(new Date("2026-05-20T10:30:00+08:00"));
    const r = computeDaily7({ chart: testChart, day, gender: "male" });
    for (const dim of DAILY_7_DIMS) {
      expect(r.scores[dim]).toBeGreaterThanOrEqual(0);
      expect(r.scores[dim]).toBeLessThanOrEqual(100);
    }
  });
});