/**
 * 当日临时命局构建（需求文档步骤 1-6）
 *
 * 把大运 + 当日干支加入原局四柱，重跑完整流水线，
 * 输出临时命局的十神能量分、帮扶/克泄耗总分、旺衰等级。
 *
 * 与 engine.ts 的 computeTemporaryFortune 类似，但：
 *   - 额外返回十神能量分（供 7 维度计算用）
 *   - 旺衰等级映射分（供总运势三权重计算用）
 *   - 刑冲合害匹配结果（供维度分修正用）
 */

import type { BaziPillars } from "@/types/domain";
import type {
  Wuxing, Stem, Branch, TenGod,
} from "@/lib/bazi/stems-branches";
import { wuxingOf, tenGod, HIDDEN_STEMS_DETAILED } from "@/lib/bazi/stems-branches";
import {
  computeWuxingCountFromGanZhi,
  applyXchhCorrectionOnZhi,
  applyWangXiangScaling,
  applyDayMasterAdjust,
  type WuxingCountMap,
  type XchhMatch,
  type StrengthType,
} from "@/lib/bazi/engine";
import { judgeFortuneLevel, type FortuneLevel } from "@/lib/bazi/labels";

// ── 类型 ──────────────────────────────────────────────────────────

export interface TempChartInput {
  /** 原局四柱 */
  pillars: BaziPillars;
  /** 月令地支 */
  monthZhi: Branch;
  /** 大运天干 */
  dayunStem: Stem;
  /** 大运地支 */
  dayunBranch: Branch;
  /** 当日天干 */
  dayGan: Stem;
  /** 当日地支 */
  dayZhi: Branch;
  /** 原局旺衰类型 */
  strengthType: StrengthType;
  /** 喜用神五行 */
  xiyongshen: Wuxing[];
  /** 忌神五行 */
  jishen: Wuxing[];
}

export interface TempChartResult {
  /** 最终五行能量分（经刑冲合害 + 旺相休囚死 + 日主微调） */
  finalScores: WuxingCountMap;
  /** 十神能量分（含权重） */
  tenGodsEnergy: Record<TenGod, number>;
  /** 帮扶总分 = 印星 + 比劫 */
  bangfuTotal: number;
  /** 克泄耗总分 = 官杀 + 财星 + 食伤 */
  kexiehaoTotal: number;
  /** 旺衰等级 */
  fortuneLevel: FortuneLevel;
  /** 旺衰等级映射分（大吉90-100 / 吉70-89 / 平50-69 / 凶30-49 / 大凶0-29） */
  fortuneLevelScore: number;
  /** 喜忌修正系数（喜用神 ×1.1 / 忌神 ×0.9 / 中性 ×1.0） */
  favorableMultiplier: number;
  /** 刑冲合害匹配（供维度分修正用） */
  xchhMatches: readonly XchhMatch[];
}

// ── 旺衰等级 → 映射分 ────────────────────────────────────────────

const FORTUNE_LEVEL_SCORE: Record<FortuneLevel, [number, number]> = {
  "大吉": [90, 100],
  "吉":   [70, 89],
  "平":   [50, 69],
  "凶":   [30, 49],
  "大凶": [0, 29],
};

function fortuneLevelToScore(level: FortuneLevel, r: number): number {
  const [lo, hi] = FORTUNE_LEVEL_SCORE[level];
  // 在等级区间内按 r 值线性插值，让同等级内也有区分度
  const t = Math.max(0, Math.min(1, r));
  return Math.round(lo + t * (hi - lo));
}

// ── 十神阵营 ──────────────────────────────────────────────────────

type TenGodCamp = "印" | "比劫" | "食伤" | "财" | "官杀";

const CAMP_MAP: Record<string, TenGodCamp> = {
  正印: "印", 偏印: "印",
  比肩: "比劫", 劫财: "比劫",
  食神: "食伤", 伤官: "食伤",
  正财: "财", 偏财: "财",
  正官: "官杀", 七杀: "官杀",
};

// ── 主入口 ────────────────────────────────────────────────────────

/**
 * 构建当日临时命局（需求文档步骤 1-6）
 *
 * 步骤 1：构建基础临时命局（原局 + 大运）
 * 步骤 2：把当日干支加入（原局 + 大运 + 当日）
 * 步骤 3：重新执行刑冲合害修正
 * 步骤 4：旺相休囚死系数缩放
 * 步骤 5：日主分微调加分
 * 步骤 6：重新计算十神能量分，更新帮扶/克泄耗总分
 */
export function buildTempChart(input: TempChartInput): TempChartResult {
  const { pillars, monthZhi, dayunStem, dayunBranch, dayGan, dayZhi, strengthType, xiyongshen, jishen } = input;

  // 步骤 1+2：构造临时干支列表（原局4 + 大运1 + 当日1）
  const ganZhiList = [
    pillars.year, pillars.month, pillars.day, pillars.hour,
    { gan: dayunStem, zhi: dayunBranch },
    { gan: dayGan, zhi: dayZhi },
  ];

  // 地支列表（刑冲合害用）
  const allZhi: Branch[] = [
    pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi,
    dayunBranch,
    dayZhi,
  ];

  // 步骤 1：五行加权计数
  const wuxingCount = computeWuxingCountFromGanZhi(ganZhiList);

  // 步骤 3：刑冲合害修正
  const xchhResult = applyXchhCorrectionOnZhi(allZhi, monthZhi, wuxingCount);

  // 步骤 4：旺相休囚死缩放
  const { scaled } = applyWangXiangScaling(xchhResult.working_count, monthZhi);

  // 步骤 5：日主微调
  const { final: finalScores } = applyDayMasterAdjust(scaled, pillars.day.gan, monthZhi);

  // 步骤 6：计算十神能量分
  const dayMaster = pillars.day.gan;
  const tenGodsEnergy = computeTenGodsEnergy(dayMaster, ganZhiList, finalScores);

  // 帮扶/克泄耗汇总
  let bangfuTotal = 0;
  let kexiehaoTotal = 0;
  for (const [tg, energy] of Object.entries(tenGodsEnergy)) {
    const camp = CAMP_MAP[tg];
    if (camp === "印" || camp === "比劫") bangfuTotal += energy;
    if (camp === "官杀" || camp === "财" || camp === "食伤") kexiehaoTotal += energy;
  }

  // 旺衰等级判定（复用 labels.ts 的 judgeFortuneLevel）
  const bangfu = Math.round(bangfuTotal * 10) / 10;
  const kexiehao = Math.round(kexiehaoTotal * 10) / 10;

  let G: number;
  let J: number;
  if (strengthType === "身强" || strengthType === "从弱格") {
    G = kexiehao; J = bangfu;
  } else if (strengthType === "身弱" || strengthType === "专旺格") {
    G = bangfu; J = kexiehao;
  } else {
    // 中和：按喜忌
    const dayWuxing = wuxingOf(dayGan);
    if (xiyongshen.includes(dayWuxing)) {
      G = bangfu + kexiehao; J = 0;
    } else if (jishen.includes(dayWuxing)) {
      G = 0; J = bangfu + kexiehao;
    } else {
      G = bangfu; J = kexiehao;
    }
  }
  const r = (G + J) > 0 ? G / (G + J) : 0.5;

  const fortuneLevel = judgeFortuneLevel(dayunStem, { r, bangfu_total: bangfu, kexiehao_total: kexiehao }, strengthType, xiyongshen, jishen);
  const fortuneLevelScore = fortuneLevelToScore(fortuneLevel, r);

  // 喜忌修正系数：当日天干五行 + 地支五行 ∈ 喜用 → ×1.1，∈ 忌神 → ×0.9
  const dayGanWuxing = wuxingOf(dayGan);
  const dayZhiWuxing = wuxingOf(dayZhi);
  const ganFav = xiyongshen.includes(dayGanWuxing);
  const zhiFav = xiyongshen.includes(dayZhiWuxing);
  const ganJi = jishen.includes(dayGanWuxing);
  const zhiJi = jishen.includes(dayZhiWuxing);

  let favorableMultiplier = 1.0;
  if (ganFav || zhiFav) favorableMultiplier = 1.1;
  else if (ganJi || zhiJi) favorableMultiplier = 0.9;

  return {
    finalScores,
    tenGodsEnergy,
    bangfuTotal: bangfu,
    kexiehaoTotal: kexiehao,
    fortuneLevel,
    fortuneLevelScore,
    favorableMultiplier,
    xchhMatches: xchhResult.matches,
  };
}

// ── 十神能量分计算 ────────────────────────────────────────────────

const ALL_TEN_GODS: TenGod[] = [
  "比肩", "劫财", "正印", "偏印",
  "食神", "伤官", "正财", "偏财",
  "正官", "七杀",
];

/**
 * 从临时命局计算各十神的能量分
 *
 * 十神能量分 = 该十神的能量占比 × 100
 * 能量占比 = 该十神能量分 ÷ 所有十神能量分总和
 */
function computeTenGodsEnergy(
  dayMaster: Stem,
  ganZhiList: ReadonlyArray<{ gan: Stem; zhi: Branch }>,
  finalScores: WuxingCountMap,
): Record<TenGod, number> {
  // 先按十神加权计数
  const rawCount: Record<TenGod, number> = {
    比肩: 0, 劫财: 0, 正印: 0, 偏印: 0,
    食神: 0, 伤官: 0, 正财: 0, 偏财: 0,
    正官: 0, 七杀: 0,
  };

  // 天干（跳过日主自身）
  let dayMasterIndex = -1;
  for (let i = 0; i < ganZhiList.length; i++) {
    if (ganZhiList[i]!.gan === dayMaster) {
      dayMasterIndex = i;
      break;
    }
  }

  for (let i = 0; i < ganZhiList.length; i++) {
    const p = ganZhiList[i]!;
    if (i === dayMasterIndex) continue;
    const tg = tenGod(dayMaster, p.gan);
    rawCount[tg] += 1;
  }

  // 地支藏干（含权重）
  for (let i = 0; i < ganZhiList.length; i++) {
    const entries = HIDDEN_STEMS_DETAILED[ganZhiList[i]!.zhi];
    for (const e of entries) {
      const tg = tenGod(dayMaster, e.gan);
      rawCount[tg] += e.coefficient;
    }
  }

  // 转化为能量分（0-100）：该十神占比 × 100
  const total = ALL_TEN_GODS.reduce((s, g) => s + rawCount[g], 0);
  const result: Record<TenGod, number> = { ...rawCount };
  if (total > 0) {
    for (const g of ALL_TEN_GODS) {
      result[g] = Math.round((rawCount[g] / total) * 100 * 10) / 10;
    }
  }

  return result;
}

/**
 * 仅构建原局临时命局（不含当日干支），用于7维度中"原局"层的十神能量分
 */
export function buildOriginTempChart(
  pillars: BaziPillars,
  monthZhi: Branch,
  dayMaster: Stem,
): { tenGodsEnergy: Record<TenGod, number>; finalScores: WuxingCountMap } {
  const ganZhiList = [pillars.year, pillars.month, pillars.day, pillars.hour];

  const wuxingCount = computeWuxingCountFromGanZhi(ganZhiList);
  const allZhi = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
  const xchhResult = applyXchhCorrectionOnZhi(allZhi, monthZhi, wuxingCount);
  const { scaled } = applyWangXiangScaling(xchhResult.working_count, monthZhi);
  const { final: finalScores } = applyDayMasterAdjust(scaled, dayMaster, monthZhi);

  const tenGodsEnergy = computeTenGodsEnergy(dayMaster, ganZhiList, finalScores);

  return { tenGodsEnergy, finalScores };
}

/**
 * 构建大运临时命局（原局+大运，不含当日），用于7维度中"大运"层的十神能量分
 */
export function buildDayunTempChart(
  pillars: BaziPillars,
  monthZhi: Branch,
  dayMaster: Stem,
  dayunStem: Stem,
  dayunBranch: Branch,
): { tenGodsEnergy: Record<TenGod, number>; finalScores: WuxingCountMap } {
  const ganZhiList = [
    pillars.year, pillars.month, pillars.day, pillars.hour,
    { gan: dayunStem, zhi: dayunBranch },
  ];

  const wuxingCount = computeWuxingCountFromGanZhi(ganZhiList);
  const allZhi: Branch[] = [
    pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi,
    dayunBranch,
  ];
  const xchhResult = applyXchhCorrectionOnZhi(allZhi, monthZhi, wuxingCount);
  const { scaled } = applyWangXiangScaling(xchhResult.working_count, monthZhi);
  const { final: finalScores } = applyDayMasterAdjust(scaled, dayMaster, monthZhi);

  const tenGodsEnergy = computeTenGodsEnergy(dayMaster, ganZhiList, finalScores);

  return { tenGodsEnergy, finalScores };
}