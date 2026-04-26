import { tenGod, wuxingOf, type Wuxing, type Stem, type Branch } from "@/lib/bazi/stems-branches";
import type { BaziComputed } from "@/types/domain";
import type { DayPillar } from "@/lib/bazi/today";

/**
 * 6 维度运势评分（spec §2.4 维度归一化到抽签 6 类）
 *
 * 维度：综合运势 / 事业学业 / 财运 / 感情姻缘 / 人际贵人 / 平安健康
 *
 * 每维度 = 60（基础）+ 五行匹配调整 + 日柱关系调整，截断到 [55, 95]
 *
 * - 五行匹配：当日五行 in chart.favorableGods → +15；in chart.avoidableGods → -10
 * - 日柱关系：当日干 vs 日主 = 十神
 *     正/偏印（生我）→ +10
 *     比/劫（同我）→ +5
 *     食/伤（我生）→ +5
 *     正/偏财（我克）→ 财运 +15，其他 +3
 *     正/七官杀（克我）→ 事业学业 +10，感情姻缘/平安健康 -5
 *
 * 综合运势 = 其他 5 维度算术平均（取整）
 */

export const DIMENSIONS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;
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

const SUB_DIMENSIONS = [
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const satisfies readonly Dimension[];

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
  for (const dim of SUB_DIMENSIONS) {
    scores[dim] = clamp(BASE + wuxingDelta + relationDelta(relation, dim));
  }

  // 综合运势 = 5 个细分维度均值
  const sum = SUB_DIMENSIONS.reduce((s, d) => s + scores[d], 0);
  scores["综合运势"] = clamp(Math.round(sum / SUB_DIMENSIONS.length));

  const overall = scores["综合运势"];

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
      if (dim === "事业学业") return 10;
      if (dim === "感情姻缘" || dim === "平安健康") return -5;
      return 0;
  }
}

/**
 * 没有 favorableGods 时的兜底：取五行计数最弱的 1-2 个为喜用
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
  return entries.filter(([, n]) => n >= 3).slice(0, 1).map(([w]) => w);
}

void (null as unknown as Branch);
