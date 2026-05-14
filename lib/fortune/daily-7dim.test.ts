import { describe, it, expect } from "vitest";
import { computeDaily7, DAILY_7_DIMS } from "./daily-7dim";
import type { Wuxing } from "@/lib/bazi/stems-branches";

const FIVE_BALANCED = { 金: 2, 木: 1, 水: 2, 火: 2, 土: 1 } as Record<Wuxing, number>;

describe("computeDaily7 (M3.24 7 维度首页评分)", () => {
  it("DAILY_7_DIMS 是 7 项", () => {
    expect([...DAILY_7_DIMS]).toEqual([
      "爱情",
      "财富",
      "事业",
      "学习",
      "健康",
      "人际",
      "心情",
    ]);
    expect(DAILY_7_DIMS.length).toBe(7);
  });

  it("7 维度都在 [55, 95]", () => {
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "甲", zhi: "子" },
    });
    for (const dim of DAILY_7_DIMS) {
      expect(r.scores[dim]).toBeGreaterThanOrEqual(55);
      expect(r.scores[dim]).toBeLessThanOrEqual(95);
    }
  });

  it("overall = 7 维简单平均（取整）", () => {
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "戊", zhi: "辰" },
    });
    const expected = Math.round(
      DAILY_7_DIMS.reduce((s, d) => s + r.scores[d], 0) / DAILY_7_DIMS.length,
    );
    expect(r.overall).toBe(expected);
  });

  it("当日干 = 喜用神 → matchedFavorable=true", () => {
    // 辛=金，木最少（仅 1）→ favorable=[木, ...]，甲=木
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "甲", zhi: "子" },
    });
    expect(r.meta.matchedFavorable).toBe(true);
  });

  it("十神=印 → 学习 +12 大幅领先", () => {
    // 辛(金)，戊(土) 生 辛 → 印
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "戊", zhi: "辰" },
    });
    expect(r.meta.relation).toBe("印");
    expect(r.scores.学习).toBeGreaterThanOrEqual(r.scores.人际);
  });

  it("十神=财 → 财富 +15 (大于其他维度)", () => {
    // 辛(金)，甲(木)，金克木 → 甲是辛的财
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "甲", zhi: "寅" },
    });
    expect(r.meta.relation).toBe("财");
    expect(r.scores.财富).toBeGreaterThanOrEqual(r.scores.学习);
  });

  it("十神=官杀 → 事业 +12 / 健康 -5 / 爱情 -3", () => {
    // 辛(金)，丙(火) → 火克金 → 官杀
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "丙", zhi: "午" },
    });
    expect(r.meta.relation).toBe("官杀");
    expect(r.scores.事业).toBeGreaterThanOrEqual(r.scores.健康);
    expect(r.scores.事业).toBeGreaterThanOrEqual(r.scores.爱情);
  });

  it("十神=比劫 → 人际 +10 大幅领先", () => {
    // 辛 vs 辛 → 比劫
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "辛", zhi: "酉" },
    });
    expect(r.meta.relation).toBe("比劫");
    expect(r.scores.人际).toBeGreaterThanOrEqual(r.scores.爱情);
    expect(r.scores.人际).toBeGreaterThanOrEqual(r.scores.学习);
  });

  it("十神=食伤 → 学习 +8 / 心情 +6", () => {
    // 辛(金) 生 水 → 壬癸是辛的食伤
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2026-04-26", gan: "壬", zhi: "子" },
    });
    expect(r.meta.relation).toBe("食伤");
    expect(r.scores.学习).toBeGreaterThanOrEqual(r.scores.健康);
    expect(r.scores.心情).toBeGreaterThanOrEqual(r.scores.健康);
  });

  it("date 透传到结果", () => {
    const r = computeDaily7({
      chart: { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      day: { date: "2027-01-01", gan: "甲", zhi: "子" },
    });
    expect(r.date).toBe("2027-01-01");
  });

  it("显式 favorableGods 覆盖兜底", () => {
    const r = computeDaily7({
      chart: {
        dayMaster: "辛",
        fiveElements: FIVE_BALANCED,
        favorableGods: ["火"],
        avoidableGods: ["水"],
      },
      day: { date: "2026-04-26", gan: "丙", zhi: "午" },
    });
    expect(r.meta.matchedFavorable).toBe(true);
    expect(r.meta.matchedAvoidable).toBe(false);
  });

  it("avoidable 命中 → 整体偏低（base+wuxing -10）", () => {
    const r = computeDaily7({
      chart: {
        dayMaster: "辛",
        fiveElements: FIVE_BALANCED,
        favorableGods: ["木"],
        avoidableGods: ["金"],
      },
      day: { date: "2026-04-26", gan: "辛", zhi: "酉" },
    });
    expect(r.meta.matchedAvoidable).toBe(true);
  });
});
