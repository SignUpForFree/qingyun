import { SHENG_CYCLE, KE_CYCLE, type Wuxing } from "@/lib/bazi/stems-branches";
import type { V2DivinationDim } from "@/lib/bazi/shensha-rules";

/**
 * 五行损益 (M3.20, spec §5.4)
 *
 * 把卦象主五行映射到抽签 6 维度并算 delta：
 *   - 卦五行与用神同党（同行 / 生我）→ 全维度 +
 *   - 卦五行克用神 → 关键维度 -（事业学业 / 财运）
 *   - 用神被卦象生 → 中性，仅小幅 +
 *
 * 五行 → 维度主导（约定）：
 *   - 木：事业学业 / 平安健康
 *   - 火：感情姻缘 / 人际贵人 / 综合运势
 *   - 土：平安健康 / 财运 / 综合运势
 *   - 金：财运 / 事业学业
 *   - 水：事业学业 / 综合运势
 *
 * delta 范围：-15 .. +15（最终 score 由各 layer 累加得来，损益是其中一层）
 */

export interface SunYiAdjustment {
  dim: V2DivinationDim;
  delta: number; // -15..+15
}

export interface SunYiResult {
  /** 与用神 yongShen 的关系：support 同党加持 / drain 生它泄气 / clash 克它 / unrelated */
  yongShenRelation: "support" | "drain" | "clash" | "unrelated";
  /** 各维度 delta */
  adjustments: ReadonlyArray<SunYiAdjustment>;
  /** 一句话总结，prompt 直接用 */
  summary: string;
}

export interface ComputeSunYiArgs {
  /** 卦象主五行（一般取体卦五行；M3.17 meihuaV2 已能拿到） */
  guaWuxing: Wuxing;
  /** 用户用神 — 缺则全维度 0 + summary "用神缺" */
  yongShen?: Wuxing | null;
}

const DIM_BY_WUXING: Record<Wuxing, ReadonlyArray<V2DivinationDim>> = {
  木: ["事业学业", "平安健康"],
  火: ["感情姻缘", "人际贵人", "综合运势"],
  土: ["平安健康", "财运", "综合运势"],
  金: ["财运", "事业学业"],
  水: ["事业学业", "综合运势"],
};

const ALL_DIMS: ReadonlyArray<V2DivinationDim> = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
];

export function computeSunYi(args: ComputeSunYiArgs): SunYiResult {
  if (args.yongShen == null) {
    return {
      yongShenRelation: "unrelated",
      adjustments: ALL_DIMS.map((d) => ({ dim: d, delta: 0 })),
      summary: "档案缺用神信息，五行损益层未启用",
    };
  }

  const relation = relateToYongShen(args.guaWuxing, args.yongShen);
  const primaryDims = DIM_BY_WUXING[args.guaWuxing];
  const adjustments = ALL_DIMS.map((dim) => {
    const isPrimary = primaryDims.includes(dim);
    const delta = computeDelta(relation, isPrimary);
    return { dim, delta };
  });

  return {
    yongShenRelation: relation,
    adjustments,
    summary: buildSummary(args.guaWuxing, args.yongShen, relation, primaryDims),
  };
}

function relateToYongShen(
  gua: Wuxing,
  yongShen: Wuxing,
): SunYiResult["yongShenRelation"] {
  if (gua === yongShen) return "support";
  if (SHENG_CYCLE[gua] === yongShen) return "support"; // 卦生用神：同党加持
  if (KE_CYCLE[gua] === yongShen) return "clash";
  if (SHENG_CYCLE[yongShen] === gua) return "drain"; // 用神生卦：泄气
  return "unrelated";
}

function computeDelta(
  relation: SunYiResult["yongShenRelation"],
  isPrimary: boolean,
): number {
  // primary 维度幅度大，非 primary 减半
  const base =
    relation === "support"
      ? 12
      : relation === "clash"
        ? -10
        : relation === "drain"
          ? -3
          : 0;
  const result = isPrimary ? base : Math.round(base / 2);
  // clamp
  return Math.max(-15, Math.min(15, result));
}

function buildSummary(
  gua: Wuxing,
  yong: Wuxing,
  rel: SunYiResult["yongShenRelation"],
  primary: ReadonlyArray<V2DivinationDim>,
): string {
  const intro = `卦象主${gua}，用神${yong}`;
  if (rel === "support") return `${intro}，相生相和，${primary.join("、")}维度顺势加持`;
  if (rel === "clash") return `${intro}，五行相克，${primary.join("、")}维度需谨慎`;
  if (rel === "drain") return `${intro}，用神被泄气，整体节奏宜放缓`;
  return `${intro}，五行无强联系，按卦势行`;
}
