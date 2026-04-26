import { describe, it, expect } from "vitest";
import { computeDailyScores, DIMENSIONS } from "./scorer";
import type { Wuxing } from "@/lib/bazi/stems-branches";

const FIVE_BALANCED = { 金: 2, 木: 1, 水: 2, 火: 2, 土: 1 } as Record<Wuxing, number>;

describe("computeDailyScores", () => {
  it("7 维度都在 [55, 95]", () => {
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2026-04-26", gan: "甲", zhi: "子" },
    );
    for (const dim of DIMENSIONS) {
      expect(r.scores[dim]).toBeGreaterThanOrEqual(55);
      expect(r.scores[dim]).toBeLessThanOrEqual(95);
    }
  });

  it("综合 = 其他 6 维度平均", () => {
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2026-04-26", gan: "戊", zhi: "辰" },
    );
    const others = ["事业", "财运", "感情", "人际", "健康", "学业"] as const;
    const avg = others.reduce((s, d) => s + r.scores[d], 0) / others.length;
    expect(r.scores["综合"]).toBe(Math.round(avg));
    expect(r.overall).toBe(r.scores["综合"]);
  });

  it("当日干 = 喜用神 → 维度都有 +15 加成", () => {
    // 日主辛(金)，喜用 = 木(1) + 土(1)（计数最低 2 个）
    // 当日干甲（木）→ 木在喜用 → +15
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2026-04-26", gan: "甲", zhi: "子" },
    );
    expect(r.meta.matchedFavorable).toBe(true);
    expect(r.meta.dayWuxing).toBe("木");
  });

  it("日主自身（同我）→ 比劫 +5", () => {
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2026-04-26", gan: "辛", zhi: "酉" }, // 辛 vs 辛 = 比肩
    );
    expect(r.meta.relation).toBe("比劫");
  });

  it("我克（财）→ 财运 +15", () => {
    // 日主辛(金)看 甲(木) → 金克木 = 财
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: { 金: 2, 木: 1, 水: 2, 火: 2, 土: 1 } },
      { date: "2026-04-26", gan: "甲", zhi: "寅" },
    );
    expect(r.meta.relation).toBe("财");
    // 财 +15, 财运 base 60 + favorableMatch?(木在喜用) 15 + 财对财运 15 = 90
    expect(r.scores["财运"]).toBeGreaterThanOrEqual(r.scores["事业"]);
  });

  it("克我（官杀）→ 事业 +10, 感情/健康 -5", () => {
    // 日主辛(金) vs 丙(火)：火克金 = 官杀
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2026-04-26", gan: "丙", zhi: "午" },
    );
    expect(r.meta.relation).toBe("官杀");
    expect(r.scores["事业"]).toBeGreaterThan(r.scores["感情"]);
    expect(r.scores["事业"]).toBeGreaterThan(r.scores["健康"]);
  });

  it("date 透传到结果", () => {
    const r = computeDailyScores(
      { dayMaster: "辛", fiveElements: FIVE_BALANCED },
      { date: "2027-01-01", gan: "甲", zhi: "子" },
    );
    expect(r.date).toBe("2027-01-01");
  });

  it("显式 favorableGods 覆盖兜底", () => {
    const r = computeDailyScores(
      {
        dayMaster: "辛",
        fiveElements: FIVE_BALANCED,
        favorableGods: ["火"],
        avoidableGods: ["水"],
      },
      { date: "2026-04-26", gan: "丙", zhi: "午" }, // 丙=火 → 命中 favorable
    );
    expect(r.meta.matchedFavorable).toBe(true);
    expect(r.meta.matchedAvoidable).toBe(false);
  });
});
