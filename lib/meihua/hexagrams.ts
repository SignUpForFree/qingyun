import { TRIGRAM_WUXING, type Trigram } from "./trigrams";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 64 卦先天序表（按通行本王肃次序）
 *
 * - HEXAGRAM_BY_PAIR[upper][lower] = { number, name }
 * - 用于把上下卦对映射到卦号 + 卦名（不含卦辞，由 seed 补）
 *
 * 8 上 × 8 下 = 64 个唯一组合（已用 test 校验全覆盖）
 */
export interface HexagramKey {
  number: number;
  name: string;
}

const HEXAGRAM_TABLE: ReadonlyArray<{
  number: number;
  name: string;
  upper: Trigram;
  lower: Trigram;
}> = [
  { number: 1, name: "乾为天", upper: "乾", lower: "乾" },
  { number: 2, name: "坤为地", upper: "坤", lower: "坤" },
  { number: 3, name: "水雷屯", upper: "坎", lower: "震" },
  { number: 4, name: "山水蒙", upper: "艮", lower: "坎" },
  { number: 5, name: "水天需", upper: "坎", lower: "乾" },
  { number: 6, name: "天水讼", upper: "乾", lower: "坎" },
  { number: 7, name: "地水师", upper: "坤", lower: "坎" },
  { number: 8, name: "水地比", upper: "坎", lower: "坤" },
  { number: 9, name: "风天小畜", upper: "巽", lower: "乾" },
  { number: 10, name: "天泽履", upper: "乾", lower: "兑" },
  { number: 11, name: "地天泰", upper: "坤", lower: "乾" },
  { number: 12, name: "天地否", upper: "乾", lower: "坤" },
  { number: 13, name: "天火同人", upper: "乾", lower: "离" },
  { number: 14, name: "火天大有", upper: "离", lower: "乾" },
  { number: 15, name: "地山谦", upper: "坤", lower: "艮" },
  { number: 16, name: "雷地豫", upper: "震", lower: "坤" },
  { number: 17, name: "泽雷随", upper: "兑", lower: "震" },
  { number: 18, name: "山风蛊", upper: "艮", lower: "巽" },
  { number: 19, name: "地泽临", upper: "坤", lower: "兑" },
  { number: 20, name: "风地观", upper: "巽", lower: "坤" },
  { number: 21, name: "火雷噬嗑", upper: "离", lower: "震" },
  { number: 22, name: "山火贲", upper: "艮", lower: "离" },
  { number: 23, name: "山地剥", upper: "艮", lower: "坤" },
  { number: 24, name: "地雷复", upper: "坤", lower: "震" },
  { number: 25, name: "天雷无妄", upper: "乾", lower: "震" },
  { number: 26, name: "山天大畜", upper: "艮", lower: "乾" },
  { number: 27, name: "山雷颐", upper: "艮", lower: "震" },
  { number: 28, name: "泽风大过", upper: "兑", lower: "巽" },
  { number: 29, name: "坎为水", upper: "坎", lower: "坎" },
  { number: 30, name: "离为火", upper: "离", lower: "离" },
  { number: 31, name: "泽山咸", upper: "兑", lower: "艮" },
  { number: 32, name: "雷风恒", upper: "震", lower: "巽" },
  { number: 33, name: "天山遯", upper: "乾", lower: "艮" },
  { number: 34, name: "雷天大壮", upper: "震", lower: "乾" },
  { number: 35, name: "火地晋", upper: "离", lower: "坤" },
  { number: 36, name: "地火明夷", upper: "坤", lower: "离" },
  { number: 37, name: "风火家人", upper: "巽", lower: "离" },
  { number: 38, name: "火泽睽", upper: "离", lower: "兑" },
  { number: 39, name: "水山蹇", upper: "坎", lower: "艮" },
  { number: 40, name: "雷水解", upper: "震", lower: "坎" },
  { number: 41, name: "山泽损", upper: "艮", lower: "兑" },
  { number: 42, name: "风雷益", upper: "巽", lower: "震" },
  { number: 43, name: "泽天夬", upper: "兑", lower: "乾" },
  { number: 44, name: "天风姤", upper: "乾", lower: "巽" },
  { number: 45, name: "泽地萃", upper: "兑", lower: "坤" },
  { number: 46, name: "地风升", upper: "坤", lower: "巽" },
  { number: 47, name: "泽水困", upper: "兑", lower: "坎" },
  { number: 48, name: "水风井", upper: "坎", lower: "巽" },
  { number: 49, name: "泽火革", upper: "兑", lower: "离" },
  { number: 50, name: "火风鼎", upper: "离", lower: "巽" },
  { number: 51, name: "震为雷", upper: "震", lower: "震" },
  { number: 52, name: "艮为山", upper: "艮", lower: "艮" },
  { number: 53, name: "风山渐", upper: "巽", lower: "艮" },
  { number: 54, name: "雷泽归妹", upper: "震", lower: "兑" },
  { number: 55, name: "雷火丰", upper: "震", lower: "离" },
  { number: 56, name: "火山旅", upper: "离", lower: "艮" },
  { number: 57, name: "巽为风", upper: "巽", lower: "巽" },
  { number: 58, name: "兑为泽", upper: "兑", lower: "兑" },
  { number: 59, name: "风水涣", upper: "巽", lower: "坎" },
  { number: 60, name: "水泽节", upper: "坎", lower: "兑" },
  { number: 61, name: "风泽中孚", upper: "巽", lower: "兑" },
  { number: 62, name: "雷山小过", upper: "震", lower: "艮" },
  { number: 63, name: "水火既济", upper: "坎", lower: "离" },
  { number: 64, name: "火水未济", upper: "离", lower: "坎" },
];

/**
 * O(1) 查询：(上卦, 下卦) → { number, name }
 *
 * 用 Map 存 `${upper}-${lower}` 键，比每次 .find 快
 */
const PAIR_INDEX: ReadonlyMap<string, HexagramKey> = new Map(
  HEXAGRAM_TABLE.map((row) => [`${row.upper}-${row.lower}`, { number: row.number, name: row.name }] as const),
);

export function findHexagram(upper: Trigram, lower: Trigram): HexagramKey {
  const hit = PAIR_INDEX.get(`${upper}-${lower}`);
  if (!hit) throw new Error(`找不到卦号 ${upper}/${lower}`);
  return hit;
}

/**
 * seed 用：64 卦完整数据（含 wuxing，从 trigram 推导）
 */
export interface HexagramSeed {
  number: number;
  name: string;
  upper: Trigram;
  lower: Trigram;
  upperWuxing: Wuxing;
  lowerWuxing: Wuxing;
}

export function listHexagrams(): readonly HexagramSeed[] {
  return HEXAGRAM_TABLE.map((row) => ({
    number: row.number,
    name: row.name,
    upper: row.upper,
    lower: row.lower,
    upperWuxing: TRIGRAM_WUXING[row.upper],
    lowerWuxing: TRIGRAM_WUXING[row.lower],
  }));
}
