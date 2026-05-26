/**
 * 7 维度首页运势评分（V2 — 对齐需求文档「每日运势计算规则」）
 *
 * 总运势分 = 大运权重分 × 30% + 流年权重分 × 40% + 当日权重分 × 30%
 *
 * 7 维度分 = 原局十神能量 × 40% + 大运十神能量 × 30% + 当日十神能量 × 30%
 *   + 极值归一缩放 + 六合三合+5 / 六冲三刑-5 修正
 *
 * 维度：爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情
 */

import { wuxingOf, tenGod, HIDDEN_STEMS_DETAILED, type Wuxing, type Stem, type Branch, type TenGod } from "@/lib/bazi/stems-branches";
import type { BaziComputed } from "@/types/domain";
import type { DayPillar } from "@/lib/bazi/today";
import type { BaziChartV2 } from "@/lib/bazi/chart";
import type { XchhMatch } from "@/lib/bazi/engine";
import {
  buildTempChart,
  buildOriginTempChart,
  buildDayunTempChart,
  type TempChartResult,
} from "./temp-chart";

// ── 维度定义 ──────────────────────────────────────────────────────

export const DAILY_7_DIMS = [
  "爱情",
  "财富",
  "事业",
  "学习",
  "健康",
  "人际",
  "心情",
] as const;
export type DailyDim7 = (typeof DAILY_7_DIMS)[number];
export type DimensionScores7 = Record<DailyDim7, number>;

export interface Daily7Result {
  date: string;
  scores: DimensionScores7;
  overall: number;
  meta: {
    dayPillar: { gan: string; zhi: string };
    dayMaster: string;
    dayWuxing: Wuxing;
    dayunFortuneLevel: string;
    liunianFortuneLevel: string;
    dayFortuneLevel: string;
  };
}

// ── 十神 → 维度映射（需求文档核心规则） ──────────────────────────

/**
 * 每个维度对应哪些十神阵营，及各阵营权重。
 * 需求文档明确：
 *   爱情男命=财星, 爱情女命=官杀; 财富=财星+食伤; 事业=官杀+印星;
 *   学习=印星+食伤; 健康=印星+比劫; 人际=比劫+食伤; 心情=食伤+印星
 */
type TenGodCamp = "印" | "比劫" | "食伤" | "财" | "官杀";

interface DimMapping {
  camps: Array<{ camp: TenGodCamp; weight: number }>;
}

const DIM_MAPPINGS: Record<DailyDim7, DimMapping> = {
  爱情: { camps: [{ camp: "财", weight: 1.0 }] },     // 男命默认；女命在 computeDimBase 中替换为官杀
  财富: { camps: [{ camp: "财", weight: 0.6 }, { camp: "食伤", weight: 0.4 }] },
  事业: { camps: [{ camp: "官杀", weight: 0.6 }, { camp: "印", weight: 0.4 }] },
  学习: { camps: [{ camp: "印", weight: 0.6 }, { camp: "食伤", weight: 0.4 }] },
  健康: { camps: [{ camp: "印", weight: 0.5 }, { camp: "比劫", weight: 0.5 }] },
  人际: { camps: [{ camp: "比劫", weight: 0.6 }, { camp: "食伤", weight: 0.4 }] },
  心情: { camps: [{ camp: "食伤", weight: 0.5 }, { camp: "印", weight: 0.5 }] },
};

const CAMP_TEN_GODS: Record<TenGodCamp, TenGod[]> = {
  印:   ["正印", "偏印"],
  比劫: ["比肩", "劫财"],
  食伤: ["食神", "伤官"],
  财:   ["正财", "偏财"],
  官杀: ["正官", "七杀"],
};

// ── 旺衰等级映射分 ────────────────────────────────────────────────

type FortuneLevel = "大吉" | "吉" | "平" | "凶" | "大凶";

const FORTUNE_LEVEL_SCORE_RANGE: Record<FortuneLevel, [number, number]> = {
  "大吉": [90, 100],
  "吉":   [70, 89],
  "平":   [50, 69],
  "凶":   [30, 49],
  "大凶": [0, 29],
};

/** 旺衰等级 → 区间中值（无 r 值时回退） */
function fortuneLevelToScore(level: string): number {
  const key = level as FortuneLevel;
  const range = FORTUNE_LEVEL_SCORE_RANGE[key] ?? [50, 69];
  return Math.round((range[0] + range[1]) / 2);
}

/** 旺衰等级 → 线性插值映射分（有 r 值时更精确） */
function fortuneLevelToScoreInterpolated(level: string, r: number): number {
  const key = level as FortuneLevel;
  const range = FORTUNE_LEVEL_SCORE_RANGE[key] ?? [50, 69];
  const t = Math.max(0, Math.min(1, r));
  return Math.round(range[0] + t * (range[1] - range[0]));
}

// ── 计算入口 ──────────────────────────────────────────────────────

export interface ComputeDaily7Args {
  chart: BaziChartV2;
  day: DayPillar;
  /** 用户性别 — 影响爱情维度十神映射 */
  gender?: "male" | "female";
}

export function computeDaily7(args: ComputeDaily7Args): Daily7Result {
  const { chart, day, gender } = args;
  const dayMaster = chart.pillars.day.gan;
  const monthZhi = chart.pillars.month.zhi;
  const dayWuxing = wuxingOf(day.gan);

  // 取当前大运
  const currentDayun = chart.dayunWithFortune?.[0];
  const dayunStem: Stem = currentDayun?.stem ?? chart.pillars.month.gan;
  const dayunBranch: Branch = currentDayun?.branch ?? chart.pillars.month.zhi;
  const dayunFortuneLevel = currentDayun?.fortune ?? "平";

  // 取当年流年
  const currentLiunian = chart.liunian?.find((ln) => ln.year === new Date().getUTCFullYear());
  const liunianStem: Stem = (currentLiunian?.stem as Stem) ?? chart.pillars.year.gan;
  const liunianBranch: Branch = (currentLiunian?.branch as Branch) ?? chart.pillars.year.zhi;
  const liunianFortuneLevel = currentLiunian?.fortune ?? "平";

  // 喜忌
  const xiyongshen = chart.yongShenFull.xiyongshen;
  const jishen = chart.yongShenFull.jishen;

  // ── 总运势分：大运30% + 流年40% + 当日30% ──

  // 大运权重分（有 r 值时线性插值，否则取中值）
  const dayunScore = currentDayun?.r != null
    ? fortuneLevelToScoreInterpolated(dayunFortuneLevel, currentDayun.r)
    : fortuneLevelToScore(dayunFortuneLevel);

  // 流年权重分 = 旺衰映射分 × 喜忌修正（有 r 值时线性插值）
  const liunianBaseScore = currentLiunian?.r != null
    ? fortuneLevelToScoreInterpolated(liunianFortuneLevel, currentLiunian.r)
    : fortuneLevelToScore(liunianFortuneLevel);
  const liunianGanWuxing = wuxingOf(liunianStem);
  const liunianZhiWuxing = wuxingOf(liunianBranch);
  const liunianGanFav = xiyongshen.includes(liunianGanWuxing);
  const liunianZhiFav = xiyongshen.includes(liunianZhiWuxing);
  const liunianGanJi = jishen.includes(liunianGanWuxing);
  const liunianZhiJi = jishen.includes(liunianZhiWuxing);
  let liunianFavMult = 1.0;
  if (liunianGanFav || liunianZhiFav) liunianFavMult = 1.1;
  else if (liunianGanJi || liunianZhiJi) liunianFavMult = 0.9;
  const liunianScore = Math.round(liunianBaseScore * liunianFavMult);

  // 当日权重分 = 临时命局旺衰映射分 × 喜忌修正
  const dayTempChart = buildTempChart({
    pillars: chart.pillars,
    monthZhi,
    dayunStem,
    dayunBranch,
    dayGan: day.gan,
    dayZhi: day.zhi,
    strengthType: chart.strength.strength_type,
    xiyongshen,
    jishen,
  });
  const dayBaseScore = dayTempChart.fortuneLevelScore;
  const dayScore = Math.round(dayBaseScore * dayTempChart.favorableMultiplier);

  // 总运势分
  const overall = clampScore(
    Math.round(dayunScore * 0.3 + liunianScore * 0.4 + dayScore * 0.3),
  );

  // ── 7 维度分：三层十神加权 + 极值归一 + 刑冲修正 ──

  // 原局十神能量分
  const originChart = buildOriginTempChart(chart.pillars, monthZhi, dayMaster);

  // 大运十神能量分
  const dayunChart = buildDayunTempChart(chart.pillars, monthZhi, dayMaster, dayunStem, dayunBranch);

  // 当日十神能量分（已在 dayTempChart 中算出）

  // 计算各维度原始基准分
  const rawScores: Record<DailyDim7, number> = {} as Record<DailyDim7, number>;
  for (const dim of DAILY_7_DIMS) {
    const originEnergy = computeDimBase(dim, originChart.tenGodsEnergy, gender);
    const dayunEnergy = computeDimBase(dim, dayunChart.tenGodsEnergy, gender);
    const dayEnergy = computeDimBase(dim, dayTempChart.tenGodsEnergy, gender);

    // 三层加权：原局40% + 大运30% + 当日30%
    rawScores[dim] = originEnergy * 0.4 + dayunEnergy * 0.3 + dayEnergy * 0.3;
  }

  // 极值归一缩放：最高维度 = 100，其他按比例
  const maxVal = Math.max(...Object.values(rawScores));
  const normalized: Record<DailyDim7, number> = {} as Record<DailyDim7, number>;
  if (maxVal > 0) {
    const scale = 100 / maxVal;
    for (const dim of DAILY_7_DIMS) {
      normalized[dim] = rawScores[dim] * scale;
    }
  } else {
    for (const dim of DAILY_7_DIMS) {
      normalized[dim] = 50;
    }
  }

  // 刑冲合害修正：当日维度十神与原局/大运 六合三合+5 / 六冲三刑-5
  const scores: DimensionScores7 = {} as DimensionScores7;
  for (const dim of DAILY_7_DIMS) {
    const correction = computeXchhCorrection(dim, dayTempChart.xchhMatches, dayMaster, gender);
    scores[dim] = clampScore(Math.round(normalized[dim] + correction));
  }

  return {
    date: day.date,
    scores,
    overall,
    meta: {
      dayPillar: { gan: day.gan, zhi: day.zhi },
      dayMaster,
      dayWuxing,
      dayunFortuneLevel: dayunFortuneLevel as string,
      liunianFortuneLevel: liunianFortuneLevel as string,
      dayFortuneLevel: dayTempChart.fortuneLevel,
    },
  };
}

// ── 辅助函数 ──────────────────────────────────────────────────────

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * 计算单个维度在某个命局层的十神能量基准分
 *
 * 每个维度有固定的十神阵营映射和权重。
 * 爱情维度：男命=财星，女命=官杀
 */
function computeDimBase(
  dim: DailyDim7,
  tenGodsEnergy: Record<TenGod, number>,
  gender?: "male" | "female",
): number {
  // 女命爱情用官杀替代财星
  const mapping = dim === "爱情" && gender === "female"
    ? { camps: [{ camp: "官杀" as TenGodCamp, weight: 1.0 }] }
    : DIM_MAPPINGS[dim];

  let total = 0;
  for (const { camp, weight } of mapping.camps) {
    const gods = CAMP_TEN_GODS[camp];
    let campEnergy = 0;
    for (const g of gods) {
      campEnergy += tenGodsEnergy[g] ?? 0;
    }
    total += campEnergy * weight;
  }

  return total;
}

/**
 * 维度分刑冲合害修正（精确版：按维度十神过滤）
 *
 * 需求文档：
 *   - 当日维度十神与原局/大运形成六合/三合：+5 分
 *   - 当日维度十神与原局/大运形成六冲/三刑：-5 分
 *
 * 精确逻辑：XCHH 匹配涉及的地支藏干中，如果包含该维度十神阵营对应的十神，
 * 则该 XCHH 对该维度生效。
 */
function computeXchhCorrection(
  dim: DailyDim7,
  xchhMatches: readonly XchhMatch[],
  dayMaster: Stem,
  gender?: "male" | "female",
): number {
  const mapping = dim === "爱情" && gender === "female"
    ? { camps: [{ camp: "官杀" as TenGodCamp, weight: 1.0 }] }
    : DIM_MAPPINGS[dim];

  // 收集该维度关心的十神集合
  const dimTenGods = new Set<TenGod>();
  for (const { camp } of mapping.camps) {
    for (const g of CAMP_TEN_GODS[camp]) {
      dimTenGods.add(g);
    }
  }

  let correction = 0;
  for (const m of xchhMatches) {
    // 检查此 XCHH 匹配涉及的地支藏干是否包含维度十神
    const relevant = m.branches.some((zhi) =>
      HIDDEN_STEMS_DETAILED[zhi].some((entry) =>
        dimTenGods.has(tenGod(dayMaster, entry.gan)),
      ),
    );
    if (!relevant) continue;

    if (m.type === "六合" || m.type === "三合") {
      correction += 5;
    } else if (m.type === "六冲" || m.type === "三刑") {
      correction -= 5;
    }
  }
  // 修正范围 [-15, +15]，防止过度修正
  return Math.max(-15, Math.min(15, correction));
}