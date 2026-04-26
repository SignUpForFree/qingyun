import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 八卦先天序（spec §5.4）：乾=1, 兑=2, 离=3, 震=4, 巽=5, 坎=6, 艮=7, 坤=8
 */
export const TRIGRAMS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as const;
export type Trigram = (typeof TRIGRAMS)[number];

export const TRIGRAM_NUMBER: Record<Trigram, number> = {
  乾: 1,
  兑: 2,
  离: 3,
  震: 4,
  巽: 5,
  坎: 6,
  艮: 7,
  坤: 8,
};

const NUMBER_TO_TRIGRAM: Record<number, Trigram> = {
  1: "乾",
  2: "兑",
  3: "离",
  4: "震",
  5: "巽",
  6: "坎",
  7: "艮",
  8: "坤",
};

export function isTrigram(s: string): s is Trigram {
  return s in TRIGRAM_NUMBER;
}

/**
 * 把先天数（1..8，0 视为 8）转回卦
 */
export function trigramByNumber(n: number): Trigram {
  if (!Number.isInteger(n)) {
    throw new TypeError(`先天卦数必须是整数：${n}`);
  }
  const normalized = n === 0 ? 8 : n;
  const t = NUMBER_TO_TRIGRAM[normalized];
  if (!t) throw new RangeError(`先天卦数 ${n} 不在 1-8 范围`);
  return t;
}

/**
 * 八卦五行（spec §5.4）：乾/兑=金, 离=火, 震/巽=木, 坎=水, 艮/坤=土
 */
export const TRIGRAM_WUXING: Record<Trigram, Wuxing> = {
  乾: "金",
  兑: "金",
  离: "火",
  震: "木",
  巽: "木",
  坎: "水",
  艮: "土",
  坤: "土",
};

/**
 * 八卦的 3 爻阴阳（从下到上：爻 1, 2, 3）
 *   true = 阳爻（―）, false = 阴爻（- -）
 *
 * 用于本卦扩展 6 爻 + 互卦取爻 + 变卦动爻翻转
 */
export const TRIGRAM_LINES: Record<Trigram, [boolean, boolean, boolean]> = {
  乾: [true, true, true],
  兑: [true, true, false],
  离: [true, false, true],
  震: [true, false, false],
  巽: [false, true, true],
  坎: [false, true, false],
  艮: [false, false, true],
  坤: [false, false, false],
};

export function linesToTrigram(lines: [boolean, boolean, boolean]): Trigram {
  for (const t of TRIGRAMS) {
    const ref = TRIGRAM_LINES[t];
    if (ref[0] === lines[0] && ref[1] === lines[1] && ref[2] === lines[2]) {
      return t;
    }
  }
  throw new Error(`非法 3 爻 pattern: ${lines.join(",")}`);
}
