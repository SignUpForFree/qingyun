import {
  wuxingOf,
  SHENG_CYCLE,
  KE_CYCLE,
  type Branch,
  type Wuxing,
} from "@/lib/bazi/stems-branches";

/**
 * 时辰能量场 (M3.19, spec §5.4)
 *
 * 起卦时辰主导一种五行能量。把这股能量与卦象主五行（用卦/体卦的五行）做生克比对：
 *   - aligned:  时辰生卦 / 时辰比和（同五行）→ 顺势
 *   - neutral:  时辰被卦生 / 卦克时辰 → 中性
 *   - conflict: 时辰克卦 → 反向力量大
 *
 * 配合 profile.yongShen（用神）做 supportYongShen 旗：时辰主导五行 == 用神 → true
 *
 * 落 prompt（M3.22）后给 AI 一个抓手而非空泛的"时辰带运"，把"看八卦"层抬高到
 * "时辰能量场" 的具象判断。
 */

export type TimeAlignment = "aligned" | "neutral" | "conflict";

export interface TimeEnergyResult {
  /** 时辰本身的五行（地支映射） */
  dominantWuxing: Wuxing;
  /** 卦象主五行（一般取体卦五行） */
  guaWuxing: Wuxing;
  /** 时辰 vs 卦象的 alignment */
  alignment: TimeAlignment;
  /** 用神（profile）是否被时辰能量加持 */
  supportYongShen: boolean | null;
  /** 一句话总结，给 prompt 直接用 */
  summary: string;
}

export interface ComputeTimeEnergyArgs {
  /** 时辰地支：起卦时间的小时柱地支（V1 cast.ts 已经有时支） */
  hourBranch: Branch;
  /** 卦象主五行（一般是体卦五行；M3.18 tiYong.ti 的五行） */
  guaWuxing: Wuxing;
  /** 用户用神（profile.yongShen）— 缺则 supportYongShen=null */
  yongShen?: Wuxing | null;
}

export function computeTimeEnergy(args: ComputeTimeEnergyArgs): TimeEnergyResult {
  const dominant = wuxingOf(args.hourBranch);
  const alignment = compareWuxing(dominant, args.guaWuxing);
  const supportYongShen =
    args.yongShen == null
      ? null
      : dominant === args.yongShen ||
        SHENG_CYCLE[dominant] === args.yongShen; // 时辰生用神也算

  return {
    dominantWuxing: dominant,
    guaWuxing: args.guaWuxing,
    alignment,
    supportYongShen,
    summary: buildSummary(dominant, args.guaWuxing, alignment, supportYongShen, args.yongShen),
  };
}

/**
 * 时辰主导五行 vs 卦象主五行：
 *   - 同 → aligned (比和)
 *   - 时辰生卦 → aligned (顺势)
 *   - 卦生时辰 → neutral (泄气，但不冲突)
 *   - 时辰克卦 → conflict
 *   - 卦克时辰 → neutral (不顺但卦势仍主)
 */
function compareWuxing(time: Wuxing, gua: Wuxing): TimeAlignment {
  if (time === gua) return "aligned";
  if (SHENG_CYCLE[time] === gua) return "aligned"; // 时辰生卦
  if (KE_CYCLE[time] === gua) return "conflict"; // 时辰克卦
  return "neutral";
}

function buildSummary(
  time: Wuxing,
  gua: Wuxing,
  alignment: TimeAlignment,
  supportYongShen: boolean | null,
  yongShen?: Wuxing | null,
): string {
  const parts: string[] = [`起卦时辰主${time}`];
  if (alignment === "aligned") parts.push(`与卦象${gua}相生相和，能量顺势`);
  else if (alignment === "conflict") parts.push(`与卦象${gua}相克，需顺缓为主`);
  else parts.push(`与卦象${gua}走中性，按卦势行`);
  if (supportYongShen === true && yongShen) {
    parts.push(`且时辰能量与用神${yongShen}相合，行动空间偏宽`);
  }
  return parts.join("，");
}
