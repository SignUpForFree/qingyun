import lunar from "lunar-javascript";
import { trigramByNumber, type Trigram } from "./trigrams";

const { Solar } = lunar;

/**
 * 起卦原始结果
 *
 * - upper / lower：本卦上下卦
 * - dongYao：动爻位（1..6，从下往上）
 */
export interface CastResult {
  upper: Trigram;
  lower: Trigram;
  /** 1..6（从下往上数），用于变卦 */
  dongYao: number;
  method: "time" | "number-1" | "number-2" | "number-3";
  /** 计算时用的输入元信息，便于回放 / 落库 */
  meta: Record<string, unknown>;
}

const BRANCH_ORDER = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

function branchIndex(branch: string): number {
  // 1..12（子=1, 亥=12）
  const idx = BRANCH_ORDER.indexOf(branch as (typeof BRANCH_ORDER)[number]);
  if (idx < 0) throw new Error(`未知地支: ${branch}`);
  return idx + 1;
}

/**
 * 时间起卦（spec §5.4）：
 *   上卦 = (年支序 + 月数 + 日数) mod 8 (0 视为 8)
 *   下卦 = (年支序 + 月数 + 日数 + 时支序) mod 8
 *   动爻 = (年支序 + 月数 + 日数 + 时支序) mod 6 (0 视为 6)
 */
export function castByTime(date: Date = new Date()): CastResult {
  // 用 UTC+8 偏移提取字段，绕开 macOS 历史 DST 表（同 lib/bazi/today.ts 模式）
  const UTC8_MS = 8 * 60 * 60 * 1000;
  const shifted = new Date(date.getTime() + UTC8_MS);
  const solar = Solar.fromYmdHms(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
  );
  const lunarObj = solar.getLunar();
  const ec = lunarObj.getEightChar();
  const yearBranch = ec.getYearZhi();
  const monthNum = lunarObj.getMonth(); // 农历月（负数代表闰月，下面取绝对值）
  const dayNum = lunarObj.getDay();
  const hourBranch = ec.getTimeZhi();

  const yIdx = branchIndex(yearBranch);
  const mAbs = Math.abs(monthNum);
  const dAbs = dayNum;
  const hIdx = branchIndex(hourBranch);

  const upperRaw = (yIdx + mAbs + dAbs) % 8;
  const lowerRaw = (yIdx + mAbs + dAbs + hIdx) % 8;
  const dongRaw = (yIdx + mAbs + dAbs + hIdx) % 6;

  return {
    upper: trigramByNumber(upperRaw === 0 ? 8 : upperRaw),
    lower: trigramByNumber(lowerRaw === 0 ? 8 : lowerRaw),
    dongYao: dongRaw === 0 ? 6 : dongRaw,
    method: "time",
    meta: {
      yearBranch,
      monthLunar: monthNum,
      dayLunar: dayNum,
      hourBranch,
      yIdx,
      m: mAbs,
      d: dAbs,
      hIdx,
    },
  };
}

/**
 * 数字起卦（spec §5.4）：1/2/3 个数字三种入口
 *   1 个: 上下卦都 = N mod 8（对称起法），动爻 = N mod 6
 *   2 个: 上 = N1 mod 8, 下 = N2 mod 8, 动 = (N1 + N2) mod 6
 *   3 个: 上 = N1 mod 8, 下 = N2 mod 8, 动 = N3 mod 6
 *
 * 整数任意正整数；0 / 负数 / 小数抛错。
 */
export function castByNumbers(...numbers: number[]): CastResult {
  for (const n of numbers) {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError(`起卦数字必须是正整数，收到 ${n}`);
    }
  }

  if (numbers.length === 1) {
    const [n] = numbers;
    const u = n! % 8;
    const dong = n! % 6;
    return {
      upper: trigramByNumber(u === 0 ? 8 : u),
      lower: trigramByNumber(u === 0 ? 8 : u),
      dongYao: dong === 0 ? 6 : dong,
      method: "number-1",
      meta: { n },
    };
  }

  if (numbers.length === 2) {
    const [n1, n2] = numbers;
    const u = n1! % 8;
    const l = n2! % 8;
    const dong = (n1! + n2!) % 6;
    return {
      upper: trigramByNumber(u === 0 ? 8 : u),
      lower: trigramByNumber(l === 0 ? 8 : l),
      dongYao: dong === 0 ? 6 : dong,
      method: "number-2",
      meta: { n1, n2 },
    };
  }

  if (numbers.length === 3) {
    const [n1, n2, n3] = numbers;
    const u = n1! % 8;
    const l = n2! % 8;
    const dong = n3! % 6;
    return {
      upper: trigramByNumber(u === 0 ? 8 : u),
      lower: trigramByNumber(l === 0 ? 8 : l),
      dongYao: dong === 0 ? 6 : dong,
      method: "number-3",
      meta: { n1, n2, n3 },
    };
  }

  throw new RangeError(`起卦数字数量必须是 1/2/3，收到 ${numbers.length}`);
}
