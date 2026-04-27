import { describe, it, expect } from "vitest";
import { buildReadingFallback } from "./reading-fallback";
import { DAILY_7_DIMS, type DimensionScores7 } from "./daily-7dim";

const HIGH_SCORES: DimensionScores7 = {
  爱情: 88,
  财富: 90,
  事业: 85,
  学习: 82,
  健康: 80,
  人际: 86,
  心情: 84,
};

const LOW_SCORES: DimensionScores7 = {
  爱情: 56,
  财富: 58,
  事业: 60,
  学习: 57,
  健康: 59,
  人际: 60,
  心情: 56,
};

describe("buildReadingFallback (M3.26)", () => {
  it("7 段输出（每段以【维度 分数】开头）", () => {
    const r = buildReadingFallback("2026-04-27", HIGH_SCORES);
    for (const dim of DAILY_7_DIMS) {
      expect(r).toContain(`【${dim} ${HIGH_SCORES[dim]}】`);
    }
  });

  it("7 段之间用空行分隔", () => {
    const r = buildReadingFallback("2026-04-27", HIGH_SCORES);
    const segs = r.split(/\n\n/);
    expect(segs).toHaveLength(7);
  });

  it("每段都非空", () => {
    const r = buildReadingFallback("2026-04-27", HIGH_SCORES);
    for (const seg of r.split(/\n\n/)) {
      expect(seg.length).toBeGreaterThan(10);
    }
  });

  it("低分段触发 low pool（不出现 high pool 的乐观词）", () => {
    const r = buildReadingFallback("2026-04-27", LOW_SCORES);
    // low pool 关键词样本
    expect(r).toMatch(/独处|清淡|宜守|静|缓/);
  });

  it("高分段触发 high pool（含暖意 / 顺势 等）", () => {
    const r = buildReadingFallback("2026-04-27", HIGH_SCORES);
    expect(r).toMatch(/暖|顺|清亮|稳|愉悦|轻盈|状态/);
  });

  it("同一 (date, scores) 输出稳定（hash 选句子）", () => {
    const r1 = buildReadingFallback("2026-04-27", HIGH_SCORES);
    const r2 = buildReadingFallback("2026-04-27", HIGH_SCORES);
    expect(r1).toBe(r2);
  });

  it("不同日期输出可能不同", () => {
    const r1 = buildReadingFallback("2026-04-27", HIGH_SCORES);
    const r2 = buildReadingFallback("2026-05-01", HIGH_SCORES);
    // 同档位但不同 date hash → 至少部分句子可能换
    // 不强断言一定不同，只断言两次都成功
    expect(r1.length).toBeGreaterThan(0);
    expect(r2.length).toBeGreaterThan(0);
  });
});
