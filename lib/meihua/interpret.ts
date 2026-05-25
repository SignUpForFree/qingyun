import { type CastResult } from "./cast";
import { findHexagram, type HexagramKey } from "./hexagrams";
import { judgeTiYong, type TiYongResult } from "./tiyong";
import {
  bianGua,
  buildHexagram,
  huGua,
  type Hexagram6,
  type HexagramShape,
} from "./transform";
import { computeYingQi, type YingQiResult } from "./ying-qi";
import type { Branch } from "@/lib/bazi/stems-branches";

/**
 * 梅花易数完整推演结果（spec §3.6 divination_records type='meihua'）
 */
export interface MeihuaResult {
  ben: HexagramView;
  hu: HexagramView;
  bian: HexagramView;
  dongYao: number;
  tiYong: TiYongResult;
  yingQi: YingQiResult;
  method: CastResult["method"];
}

export interface HexagramView extends HexagramKey {
  upper: HexagramShape["upper"];
  lower: HexagramShape["lower"];
  lines: Hexagram6;
}

/**
 * 把 cast 结果（上下卦 + 动爻）走完一整套梅花易数推演
 *
 * 不调用 AI；返回纯算法结果，供 /api/divination/meihua 落库 + prompt 模板
 *
 * @param cast      castByTime / castByNumbers 的输出
 * @param hourBranch 时间起卦时填入用于应期 branchHour，数字起卦传 undefined
 */
export function interpretMeihua(
  cast: CastResult,
  hourBranch?: Branch,
): MeihuaResult {
  const benShape = buildHexagram(cast.upper, cast.lower);
  const huShape = huGua(benShape);
  const bianShape = bianGua(benShape, cast.dongYao);

  const tiYong = judgeTiYong({
    upper: cast.upper,
    lower: cast.lower,
    dongYao: cast.dongYao,
  });

  const yingQi = computeYingQi({
    relation: tiYong.relation,
    dongYao: cast.dongYao,
    bianGuaHourBranch: hourBranch,
  });

  return {
    ben: shapeToView(benShape),
    hu: shapeToView(huShape),
    bian: shapeToView(bianShape),
    dongYao: cast.dongYao,
    tiYong,
    yingQi,
    method: cast.method,
  };
}

function shapeToView(s: HexagramShape): HexagramView {
  const key = findHexagram(s.upper, s.lower);
  return {
    ...key,
    upper: s.upper,
    lower: s.lower,
    lines: s.lines,
  };
}
