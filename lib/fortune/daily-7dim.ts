import { tenGod, wuxingOf, type Wuxing, type Stem } from "@/lib/bazi/stems-branches";
import type { BaziComputed } from "@/types/domain";
import type { DayPillar } from "@/lib/bazi/today";

/**
 * 7 维度首页运势评分 (M3.24, spec §5.3)
 *
 * 与 V2 抽签的 6 维度（综合运势/事业学业/财运/感情姻缘/人际贵人/平安健康）
 * 不强求统一 — 首页运势按生活语义分 7 类，体感更直观。
 *
 * 维度：爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情
 *
 * 加权（plan §M3.24）：爱情 15 + 财富 20 + 事业 20 + 学习 10 + 健康 15 + 人际 10 + 心情 10 = 100
 *
 * 算法（每维 60 base + delta，clamp [55, 95]）：
 *   - wuxingDelta: 当日干五行 in favorable → +15；in avoidable → -10
 *   - relationDelta: 当日干 vs 日主 = 十神，按维度配重
 *
 * 十神 → 维度重点：
 *   - 印 (生我)  → 学习 +12 / 事业 +6 / 健康 +5 / 心情 +3
 *   - 比劫 (同) → 人际 +10 / 心情 +5
 *   - 食伤 (我生)→ 学习 +8 / 心情 +6 / 财富 +3
 *   - 财 (我克)  → 财富 +15 / 爱情 +5 / 事业 +3
 *   - 官杀 (克我)→ 事业 +12 / 健康 -5 / 心情 -3 / 爱情 -3
 */

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
  overall: number; // 加权和（不取均值）
  meta: {
    dayPillar: { gan: string; zhi: string };
    dayMaster: string;
    dayWuxing: Wuxing;
    relation: TenGodCategory;
    matchedFavorable: boolean;
    matchedAvoidable: boolean;
  };
}

type TenGodCategory = "印" | "比劫" | "食伤" | "财" | "官杀";

const RELATION_BY_TEN_GOD: Record<string, TenGodCategory> = {
  正印: "印",
  偏印: "印",
  比肩: "比劫",
  劫财: "比劫",
  食神: "食伤",
  伤官: "食伤",
  正财: "财",
  偏财: "财",
  正官: "官杀",
  七杀: "官杀",
};

const BASE = 60;
const MIN = 55;
const MAX = 95;

function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, n));
}

/** 维度 × 十神 二维 delta 表 */
const RELATION_DELTA: Record<TenGodCategory, Record<DailyDim7, number>> = {
  印: { 学习: 12, 事业: 6, 健康: 5, 心情: 3, 爱情: 0, 财富: 0, 人际: 0 },
  比劫: { 人际: 10, 心情: 5, 爱情: 0, 财富: 0, 事业: 0, 学习: 0, 健康: 0 },
  食伤: { 学习: 8, 心情: 6, 财富: 3, 爱情: 0, 事业: 0, 健康: 0, 人际: 0 },
  财: { 财富: 15, 爱情: 5, 事业: 3, 学习: 0, 健康: 0, 人际: 0, 心情: 0 },
  官杀: {
    事业: 12,
    健康: -5,
    心情: -3,
    爱情: -3,
    财富: 0,
    学习: 0,
    人际: 0,
  },
};

export interface ComputeDaily7Args {
  chart: {
    dayMaster: BaziComputed["dayMaster"] | string;
    fiveElements: BaziComputed["fiveElements"];
    favorableGods?: Wuxing[] | null;
    avoidableGods?: Wuxing[] | null;
  };
  day: DayPillar;
}

export function computeDaily7(args: ComputeDaily7Args): Daily7Result {
  const dayWuxing = wuxingOf(args.day.gan);
  const dayMaster = args.chart.dayMaster as Stem;

  const favorable = args.chart.favorableGods ?? deriveFavorable(args.chart);
  const avoidable = args.chart.avoidableGods ?? deriveAvoidable(args.chart);

  const matchedFavorable = favorable.includes(dayWuxing);
  const matchedAvoidable = avoidable.includes(dayWuxing);

  const wuxingDelta = matchedFavorable ? 15 : matchedAvoidable ? -10 : 0;

  const tg = tenGod(dayMaster, args.day.gan);
  const relation: TenGodCategory = RELATION_BY_TEN_GOD[tg] ?? "比劫";
  const deltaTable = RELATION_DELTA[relation];

  const scores: DimensionScores7 = {} as DimensionScores7;
  for (const dim of DAILY_7_DIMS) {
    scores[dim] = clamp(BASE + wuxingDelta + deltaTable[dim]);
  }

  const overall = Math.round(
    DAILY_7_DIMS.reduce((sum, dim) => sum + scores[dim], 0) / DAILY_7_DIMS.length,
  );

  return {
    date: args.day.date,
    scores,
    overall,
    meta: {
      dayPillar: { gan: args.day.gan, zhi: args.day.zhi },
      dayMaster,
      dayWuxing,
      relation,
      matchedFavorable,
      matchedAvoidable,
    },
  };
}

function deriveFavorable(
  chart: Pick<BaziComputed, "fiveElements">,
): Wuxing[] {
  const entries = Object.entries(chart.fiveElements) as Array<[Wuxing, number]>;
  entries.sort((a, b) => a[1] - b[1]);
  return entries.slice(0, 2).map(([w]) => w);
}

function deriveAvoidable(
  chart: Pick<BaziComputed, "fiveElements">,
): Wuxing[] {
  const entries = Object.entries(chart.fiveElements) as Array<[Wuxing, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries
    .filter(([, n]) => n >= 3)
    .slice(0, 1)
    .map(([w]) => w);
}
