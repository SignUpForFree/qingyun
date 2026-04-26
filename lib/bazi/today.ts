import lunar from "lunar-javascript";
import { isStem, isBranch, type Stem, type Branch } from "./stems-branches";

const { Solar } = lunar;

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface DayPillar {
  /** ISO yyyy-mm-dd（UTC+8） */
  date: string;
  gan: Stem;
  zhi: Branch;
}

/**
 * 算指定日期的"日干支"（不含时辰，只到日）
 *
 * @param date  默认 = 当前时刻；UTC+8 时区基准
 */
export function getDayPillar(date: Date = new Date()): DayPillar {
  const d = new Date(date.getTime() + UTC8_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  // 用正午算，避免子时跨日导致 lunar-javascript 取了错误日柱
  const solar = Solar.fromYmdHms(y, m, day, 12, 0, 0);
  const ec = solar.getLunar().getEightChar();
  const gan = ec.getDayGan();
  const zhi = ec.getDayZhi();

  if (!isStem(gan) || !isBranch(zhi)) {
    throw new Error(`lunar-javascript 返回非法日柱: ${gan}${zhi}`);
  }

  return {
    date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    gan,
    zhi,
  };
}
