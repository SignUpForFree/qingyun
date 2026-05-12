import { getDayPillar } from "@/lib/bazi/today";

/**
 * 运势周期工具（UTC+8 日历日，与日柱算法一致）— 周一起算，与 ISO 周一致。
 */

/** 将 ISO 日向前/后推 n 天（n 可为负），返回 YYYY-MM-DD */
export function addCalendarDaysIso(anchorIso: string, deltaDays: number): string {
  const ms = new Date(`${anchorIso}T12:00:00+08:00`).getTime() + deltaDays * 86_400_000;
  return getDayPillar(new Date(ms)).date;
}

/** 周一=0 … 周日=6（按 anchor 当日在客历中的星期） */
export function weekdayMonday0(anchorIso: string): number {
  const ms = new Date(`${anchorIso}T12:00:00+08:00`).getTime();
  const sun0 = new Date(ms).getUTCDay();
  return (sun0 + 6) % 7;
}

/** 含 anchorIso 的那一周，周一的 YYYY-MM-DD */
export function mondayOfWeekContaining(anchorIso: string): string {
  const off = weekdayMonday0(anchorIso);
  return addCalendarDaysIso(anchorIso, -off);
}

/** 周一为起点，连续 7 天 ISO 串 */
export function datesInWeekFromMonday(weekStartIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addCalendarDaysIso(weekStartIso, i));
}

/** YYYY-MM */
export function monthKeyFromIso(anchorIso: string): string {
  return anchorIso.slice(0, 7);
}

/** 公历月内所有 YYYY-MM-DD */
export function datesInCalendarMonth(ym: string): string[] {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) return [];
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= dim; d++) {
    out.push(`${yStr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** 展示用：M/D–M/D */
export function formatWeekRangeCn(weekStartIso: string): string {
  const end = addCalendarDaysIso(weekStartIso, 6);
  const [y1, m1, d1] = weekStartIso.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  void y1;
  return `${m1}/${d1}–${m2}/${d2}`;
}
