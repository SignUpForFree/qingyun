import {
  TRIGRAM_LINES,
  linesToTrigram,
  type Trigram,
} from "./trigrams";

/**
 * 一个完整 6 爻卦：从下到上爻 1..6
 *   true  = 阳
 *   false = 阴
 */
export type Hexagram6 = [boolean, boolean, boolean, boolean, boolean, boolean];

export interface HexagramShape {
  upper: Trigram;
  lower: Trigram;
  lines: Hexagram6;
}

export function buildHexagram(upper: Trigram, lower: Trigram): HexagramShape {
  const u = TRIGRAM_LINES[upper];
  const l = TRIGRAM_LINES[lower];
  return {
    upper,
    lower,
    lines: [l[0], l[1], l[2], u[0], u[1], u[2]],
  };
}

/**
 * 互卦（spec §5.4）：本卦 2-3-4 爻作下卦 + 3-4-5 爻作上卦
 *
 * 注意 spec 写的是『2-3-4 爻作下卦』指爻号（1-indexed），
 * 即数组下标 [1][2][3] 作下卦三爻，[2][3][4] 作上卦三爻
 */
export function huGua(h: HexagramShape): HexagramShape {
  const lower3: [boolean, boolean, boolean] = [h.lines[1], h.lines[2], h.lines[3]];
  const upper3: [boolean, boolean, boolean] = [h.lines[2], h.lines[3], h.lines[4]];
  return {
    lower: linesToTrigram(lower3),
    upper: linesToTrigram(upper3),
    lines: [...lower3, ...upper3] as Hexagram6,
  };
}

/**
 * 变卦（spec §5.4）：本卦动爻位阴阳翻转
 */
export function bianGua(h: HexagramShape, dongYao: number): HexagramShape {
  if (!Number.isInteger(dongYao) || dongYao < 1 || dongYao > 6) {
    throw new RangeError(`动爻必须是 1-6 整数，收到 ${dongYao}`);
  }
  const newLines = [...h.lines] as Hexagram6;
  newLines[dongYao - 1] = !newLines[dongYao - 1];
  const lower3: [boolean, boolean, boolean] = [newLines[0], newLines[1], newLines[2]];
  const upper3: [boolean, boolean, boolean] = [newLines[3], newLines[4], newLines[5]];
  return {
    lower: linesToTrigram(lower3),
    upper: linesToTrigram(upper3),
    lines: newLines,
  };
}

/**
 * 卦中卦（spec §5.4 档 4 加项）：变卦的互卦
 */
export function guaZhongGua(h: HexagramShape, dongYao: number): HexagramShape {
  return huGua(bianGua(h, dongYao));
}
