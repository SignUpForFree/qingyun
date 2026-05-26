/**
 * 第一喜用神五行判定 + 当日喜用神匹配度
 *
 * 三步公式（需求文档 §幸运物推荐规则）：
 *   1. 调候用神优先级最高
 *   2. 能量平衡分（喜用方向中能量越低得分越高）
 *   3. 通关调候分（调候/通关/普通三级）
 *
 * 综合得分 = 能量平衡分 × 0.7 + 通关调候分 × 0.3
 */

import type { Wuxing, Stem, Branch } from "@/lib/bazi/stems-branches";
import { wuxingOf } from "@/lib/bazi/stems-branches";
import type { BaziChartV2 } from "@/lib/bazi/chart";

const ALL_WUXING: Wuxing[] = ["金", "木", "水", "火", "土"];

// ── 第一喜用神五行判定 ───────────────────────────────────────────

interface FirstXiyongResult {
  /** 第一喜用神五行 */
  wuxing: Wuxing;
  /** 各候选五行综合得分 */
  scores: Record<Wuxing, number>;
}

export function computeFirstXiyong(chart: BaziChartV2): FirstXiyongResult {
  const { xiyongshen, jishen, tiaohou_shen, tongguan_wuxing } = chart.yongShenFull;
  const finalScores = chart.finalScores;

  // 步骤 1：调候用神优先 — 取调候候选中综合得分最高的
  if (tiaohou_shen.length > 0) {
    const allScores = computeAllScores(xiyongshen, jishen, tiaohou_shen, tongguan_wuxing, finalScores);
    let best: Wuxing = tiaohou_shen[0]!;
    let bestScore = -1;
    for (const wx of tiaohou_shen) {
      if (allScores[wx] > bestScore) {
        bestScore = allScores[wx];
        best = wx;
      }
    }
    return { wuxing: best, scores: allScores };
  }

  // 步骤 2+3：能量平衡 + 通关调候
  const allScores = computeAllScores(xiyongshen, jishen, tiaohou_shen, tongguan_wuxing, finalScores);

  // 从喜用神方向中取综合得分最高的
  let best: Wuxing = xiyongshen[0] ?? "金";
  let bestScore = -1;
  for (const wx of xiyongshen) {
    if (allScores[wx] > bestScore) {
      bestScore = allScores[wx];
      best = wx;
    }
  }

  return { wuxing: best, scores: allScores };
}

function computeAllScores(
  xiyongshen: Wuxing[],
  jishen: Wuxing[],
  tiaohou_shen: Wuxing[],
  tongguan_wuxing: Wuxing[],
  finalScores: Record<Wuxing, number>,
): Record<Wuxing, number> {
  const result: Record<Wuxing, number> = {} as Record<Wuxing, number>;

  for (const wx of ALL_WUXING) {
    const isXi = xiyongshen.includes(wx);
    const isJi = jishen.includes(wx);
    const energyBalance = isJi ? 0 : energyBalanceScore(finalScores[wx]);
    const tongguanTiaohou = tongguanTiaohouScore(wx, tiaohou_shen, tongguan_wuxing, isXi, isJi);
    result[wx] = Math.round(energyBalance * 0.7 + tongguanTiaohou * 0.3);
  }

  return result;
}

/** 能量平衡分（0-70）：能量越低得分越高 */
function energyBalanceScore(energy: number): number {
  if (energy < 10) return 70;
  if (energy < 20) return 50;
  if (energy < 30) return 30;
  return 10;
}

/** 通关调候分（0-30） */
function tongguanTiaohouScore(
  wx: Wuxing,
  tiaohou_shen: Wuxing[],
  tongguan_wuxing: Wuxing[],
  isXi: boolean,
  isJi: boolean,
): number {
  if (isJi) return 0;
  if (tiaohou_shen.includes(wx)) return 30;
  if (tongguan_wuxing.includes(wx)) return 20;
  if (isXi) return 10;
  return 0;
}

// ── 当日喜用神匹配度 ─────────────────────────────────────────────

export interface DayXiyongMatch {
  /** 当日喜用神五行（匹配度最高的那个，或回退到原局第一喜用神） */
  wuxing: Wuxing;
  /** 匹配度得分 */
  matchScore: number;
}

/**
 * 计算当日喜用神匹配度
 *
 * 规则：
 *   当日天干五行 ∈ 喜用神 → +10
 *   当日地支五行 ∈ 喜用神 → +10
 *   天干地支五行相同且都属于喜用神 → 额外 +5
 *   都不属于 → 匹配度 0，取原局第一喜用神五行
 */
export function computeDayXiyongMatch(
  chart: BaziChartV2,
  dayGan: Stem,
  dayZhi: Branch,
): DayXiyongMatch {
  const xiyongshen = chart.yongShenFull.xiyongshen;
  const firstXiyong = computeFirstXiyong(chart).wuxing;

  const ganWuxing = wuxingOf(dayGan);
  const zhiWuxing = wuxingOf(dayZhi);

  const ganMatch = xiyongshen.includes(ganWuxing);
  const zhiMatch = xiyongshen.includes(zhiWuxing);

  let matchScore = 0;
  if (ganMatch) matchScore += 10;
  if (zhiMatch) matchScore += 10;
  if (ganMatch && zhiMatch && ganWuxing === zhiWuxing) matchScore += 5;

  if (matchScore === 0) {
    // 都不是喜用神 → 取原局第一喜用神五行
    return { wuxing: firstXiyong, matchScore: 0 };
  }

  // 两者都匹配且五行相同 → 取该五行
  if (ganMatch && zhiMatch && ganWuxing === zhiWuxing) {
    return { wuxing: zhiWuxing, matchScore };
  }

  // 两者都匹配但五行不同 → 用第一喜用神综合得分打破平局
  if (ganMatch && zhiMatch) {
    const xiyongScores = computeFirstXiyong(chart).scores;
    const ganScore = xiyongScores[ganWuxing];
    const zhiScore = xiyongScores[zhiWuxing];
    // 优先取综合得分更高的；得分相同则按需求"优先取地支五行"
    if (zhiScore >= ganScore) {
      return { wuxing: zhiWuxing, matchScore };
    }
    return { wuxing: ganWuxing, matchScore };
  }
  if (ganMatch) {
    return { wuxing: ganWuxing, matchScore };
  }
  // zhiMatch
  return { wuxing: zhiWuxing, matchScore };
}