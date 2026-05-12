import { describe, it, expect } from "vitest";
import type { DimensionScores7 } from "./daily-7dim";
import { averageDimensionScores7, weightedOverallFromDim7 } from "./aggregate-dim7";

describe("aggregate-dim7", () => {
  it("averages each dimension", () => {
    const a: DimensionScores7 = {
      爱情: 60,
      财富: 70,
      事业: 60,
      学习: 60,
      健康: 60,
      人际: 60,
      心情: 60,
    };
    const b: DimensionScores7 = { ...a, 爱情: 80, 财富: 90 };
    const avg = averageDimensionScores7([a, b]);
    expect(avg.爱情).toBe(70);
    expect(avg.财富).toBe(80);
  });

  it("weightedOverallFromDim7 matches daily-7dim weighting idea", () => {
    const flat: DimensionScores7 = {
      爱情: 80,
      财富: 80,
      事业: 80,
      学习: 80,
      健康: 80,
      人际: 80,
      心情: 80,
    };
    expect(weightedOverallFromDim7(flat)).toBe(80);
  });
});
