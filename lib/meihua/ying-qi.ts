import type { Branch } from "@/lib/bazi/stems-branches";
import type { TiYongRelation } from "./tiyong";

/**
 * 应期推算（spec §5.4 简化版）
 *
 * 规则：
 *   相生类（ti_sheng_yong / yong_sheng_ti）→ speed='fast',   timeHint='1-3 日内' 或 '本周内'
 *   比和（bi_he）                            → speed='medium', timeHint='本月内'
 *   相克类（ti_ke_yong / yong_ke_ti）        → speed='slow',   timeHint='1-3 个月内'
 *
 * branchHour（变爻地支对应时辰）由调用方按需传入
 *
 * **抽象层**：本文件独立封装简化规则，正式应期规则引擎到位后整块替换
 *           （同 fortune/scorer.ts 模式）
 */

export type YingQiSpeed = "fast" | "medium" | "slow";

export interface YingQiResult {
  speed: YingQiSpeed;
  timeHint: string;
  branchHour: string | null;
}

const HOUR_RANGE_BY_BRANCH: Record<Branch, string> = {
  子: "23–1 点",
  丑: "1–3 点",
  寅: "3–5 点",
  卯: "5–7 点",
  辰: "7–9 点",
  巳: "9–11 点",
  午: "11–13 点",
  未: "13–15 点",
  申: "15–17 点",
  酉: "17–19 点",
  戌: "19–21 点",
  亥: "21–23 点",
};

export function computeYingQi(input: {
  relation: TiYongRelation;
  dongYao: number;
  /** 变爻地支（可选，时间起卦时填，数字起卦无） */
  bianGuaHourBranch?: Branch;
}): YingQiResult {
  if (!Number.isInteger(input.dongYao) || input.dongYao < 1 || input.dongYao > 6) {
    throw new RangeError(`动爻必须是 1-6，收到 ${input.dongYao}`);
  }

  let speed: YingQiSpeed;
  let timeHint: string;

  switch (input.relation) {
    case "ti_sheng_yong":
    case "yong_sheng_ti":
      speed = "fast";
      // 动爻越靠下越快显（1-3 日内），靠上稍缓（本周内）
      timeHint = input.dongYao <= 3 ? "1–3 日内" : "本周内";
      break;
    case "bi_he":
      speed = "medium";
      timeHint = "本月内";
      break;
    case "ti_ke_yong":
    case "yong_ke_ti":
      speed = "slow";
      timeHint = "1–3 个月内";
      break;
  }

  const branchHour = input.bianGuaHourBranch
    ? `${input.bianGuaHourBranch}时（${HOUR_RANGE_BY_BRANCH[input.bianGuaHourBranch]}）`
    : null;

  return { speed, timeHint, branchHour };
}
