import { DAILY_7_DIMS, type DimensionScores7 } from "./daily-7dim";

/**
 * 多条日维 7 分 → 各维算术平均（四舍五入），综合分取7维简单平均。
 * 用于周运 / 月运：对周期内每日 computeDaily7.scores 聚合。
 */
export function averageDimensionScores7(rows: DimensionScores7[]): DimensionScores7 {
  if (rows.length === 0) {
    throw new Error("averageDimensionScores7: empty rows");
  }
  const out = {} as DimensionScores7;
  for (const dim of DAILY_7_DIMS) {
    const sum = rows.reduce((s, r) => s + r[dim], 0);
    out[dim] = Math.round(sum / rows.length);
  }
  return out;
}

export function weightedOverallFromDim7(scores: DimensionScores7): number {
  return Math.round(
    DAILY_7_DIMS.reduce((sum, dim) => sum + scores[dim], 0) / DAILY_7_DIMS.length,
  );
}
