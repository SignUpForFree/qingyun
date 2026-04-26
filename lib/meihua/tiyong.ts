import type { Trigram } from "./trigrams";
import { TRIGRAM_WUXING } from "./trigrams";
import { relate } from "./wuxing";

/**
 * 体用关系五分类（spec §5.4）
 *
 * - ti_ke_yong   体克用 · 吉
 * - yong_ke_ti   用克体 · 凶（梅花术语，但不外显，prompt 转『需谨慎』）
 * - ti_sheng_yong 体生用 · 泄气，略不利
 * - yong_sheng_ti 用生体 · 大吉
 * - bi_he         体用比和 · 平顺
 */
export type TiYongRelation =
  | "ti_ke_yong"
  | "yong_ke_ti"
  | "ti_sheng_yong"
  | "yong_sheng_ti"
  | "bi_he";

export interface TiYongResult {
  /** 体卦（自己） */
  ti: Trigram;
  /** 用卦（事情） */
  yong: Trigram;
  relation: TiYongRelation;
}

/**
 * 体用判定（spec §5.4）：
 *   动爻在 1/2/3 爻 (下卦) → 下卦=用, 上卦=体
 *   动爻在 4/5/6 爻 (上卦) → 上卦=用, 下卦=体
 *
 * 注意 spec 写的是『动爻在哪一卦，那一卦就是用』
 */
export function judgeTiYong(input: {
  upper: Trigram;
  lower: Trigram;
  dongYao: number;
}): TiYongResult {
  const { upper, lower, dongYao } = input;
  if (!Number.isInteger(dongYao) || dongYao < 1 || dongYao > 6) {
    throw new RangeError(`动爻必须是 1-6，收到 ${dongYao}`);
  }

  let ti: Trigram;
  let yong: Trigram;
  if (dongYao <= 3) {
    yong = lower;
    ti = upper;
  } else {
    yong = upper;
    ti = lower;
  }

  const tiW = TRIGRAM_WUXING[ti];
  const yongW = TRIGRAM_WUXING[yong];
  const r = relate(tiW, yongW);

  let relation: TiYongRelation;
  switch (r) {
    case "he":
      relation = "bi_he";
      break;
    case "sheng":
      // 体 -> 用：体生用（泄气）
      relation = "ti_sheng_yong";
      break;
    case "ke":
      // 体 -> 用：体克用（吉）
      relation = "ti_ke_yong";
      break;
    case "sheng_by":
      // 用 -> 体：用生体（大吉）
      relation = "yong_sheng_ti";
      break;
    case "ke_by":
      // 用 -> 体：用克体（凶）
      relation = "yong_ke_ti";
      break;
  }

  return { ti, yong, relation };
}
