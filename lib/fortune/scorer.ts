import { tenGod, wuxingOf, type Wuxing, type Stem, type Branch } from "@/lib/bazi/stems-branches";
import type { BaziComputed } from "@/types/domain";
import type { DayPillar } from "@/lib/bazi/today";

/**
 * 7 维度运势评分（spec §5.3 MVP 简化版）
 *
 * 每维度 = 60（基础）+ 五行匹配调整 + 日柱关系调整，截断到 [55, 95]
 *
 * - 五行匹配：当日五行 in chart.favorableGods → +15；in chart.忌神 → -10
 * - 日柱关系：当日干 vs 日主 = 十神
 *     正/偏印（生我）→ +10
 *     比/劫（同我）→ +5
 *     食/伤（我生）→ +5
 *     正/偏财（我克）→ 财运 +15，其他 +3
 *     正/七官杀（克我）→ 事业 +10，感情/健康 -5
 *
 * 总分 = 7 维度算术平均（向下取整）
 */

export const DIMENSIONS = ["综合", "事业", "财运", "感情", "人际", "健康", "学业"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type DimensionScores = Record<Dimension, number>;

export interface DailyScores {
  date: string;
  scores: DimensionScores;
  overall: number;
  /** 计算时用的元信息，便于调试和缓存命中后回显 */
  meta: {
    dayPillar: { gan: string; zhi: string };
    dayMaster: string;
    dayWuxing: Wuxing;
    dayMasterWuxing: Wuxing;
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

export function computeDailyScores(
  chart: {
    dayMaster: BaziComputed["dayMaster"] | string;
    fiveElements: BaziComputed["fiveElements"];
    favorableGods?: Wuxing[] | null;
    avoidableGods?: Wuxing[] | null;
  },
  day: DayPillar,
): DailyScores {
  const dayWuxing = wuxingOf(day.gan);
  const dayMaster = chart.dayMaster as Stem;
  const dayMasterWuxing = wuxingOf(dayMaster);

  const favorable = chart.favorableGods ?? deriveFavorable(chart);
  const avoidable = chart.avoidableGods ?? deriveAvoidable(chart);

  const matchedFavorable = favorable.includes(dayWuxing);
  const matchedAvoidable = avoidable.includes(dayWuxing);

  const wuxingDelta = matchedFavorable ? 15 : matchedAvoidable ? -10 : 0;

  const tg = tenGod(dayMaster, day.gan);
  const relation = RELATION_BY_TEN_GOD[tg] ?? "比劫";

  const scores: DimensionScores = {} as DimensionScores;
  for (const dim of DIMENSIONS) {
    scores[dim] = clamp(BASE + wuxingDelta + relationDelta(relation, dim));
  }

  // 综合 = 其他 6 维度均值 + 一点平滑
  const otherAvg =
    (scores["事业"] +
      scores["财运"] +
      scores["感情"] +
      scores["人际"] +
      scores["健康"] +
      scores["学业"]) /
    6;
  scores["综合"] = clamp(Math.round(otherAvg));

  const overall = scores["综合"];

  return {
    date: day.date,
    scores,
    overall,
    meta: {
      dayPillar: { gan: day.gan, zhi: day.zhi },
      dayMaster,
      dayWuxing,
      dayMasterWuxing,
      relation,
      matchedFavorable,
      matchedAvoidable,
    },
  };
}

function relationDelta(rel: TenGodCategory, dim: Dimension): number {
  switch (rel) {
    case "印":
      return 10;
    case "比劫":
      return 5;
    case "食伤":
      return 5;
    case "财":
      return dim === "财运" ? 15 : 3;
    case "官杀":
      if (dim === "事业") return 10;
      if (dim === "感情" || dim === "健康") return -5;
      return 0;
  }
}

/**
 * 没有 favorableGods 时的兜底：取五行计数最弱的 1-2 个为喜用
 * （MVP 极简，正经规则引擎到位后用真正喜用神算法替换）
 */
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
  // 计数最高那个（如果计数 ≥ 3 才视为忌，避免没有偏忌时全 -10）
  return entries.filter(([, n]) => n >= 3).slice(0, 1).map(([w]) => w);
}

// 让 Branch 类型在 import 里别报 unused（为未来日支推算保留）
void (null as unknown as Branch);
