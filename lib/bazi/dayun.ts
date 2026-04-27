import type { BaziPillars } from "@/types/domain";
import type { Stem, Branch } from "./stems-branches";
import { TEN_STEMS, TWELVE_BRANCHES } from "./stems-branches";

/**
 * 大运 + 流年 (M3.8 / M3.9)
 *
 * 大运起运规则（spec §5.5）：
 *   - 阳年男 / 阴年女：顺排（月柱+1, +2, ..., +7）
 *   - 阴年男 / 阳年女：逆排（月柱-1, -2, ..., -7）
 *
 * 起运岁数（简化版）：从出生到下一节气日数除以 3，整数为起运虚岁。
 *   - 顺排：到下一节气
 *   - 逆排：到上一节气
 *   - 这里用 365 / 12 ≈ 30 日近似（精确版需 lunar-javascript 拿节气）
 *
 * 流年：取前 2 年 + 当年 + 后 2 年共 5 个年柱（甲子序循环 60 年）。
 */

const YANG_STEMS: ReadonlySet<Stem> = new Set(["甲", "丙", "戊", "庚", "壬"]);

function isYangStem(s: Stem): boolean {
  return YANG_STEMS.has(s);
}

export interface DayunStep {
  index: number; // 1..8
  stem: Stem;
  branch: Branch;
  pillar: string; // e.g. "戊寅"
  startAge: number; // 虚岁
  endAge: number;
}

export interface ComputeDayunArgs {
  pillars: BaziPillars;
  gender: "male" | "female";
  solarBirthDate: Date;
  /** 起运岁数（虚岁），可选；不传则按出生月日近似估算 */
  startAge?: number;
  /** 大运步数，默认 8 */
  steps?: number;
}

export function computeDayun(args: ComputeDayunArgs): DayunStep[] {
  const yangYear = isYangStem(args.pillars.year.gan);
  const forward =
    (yangYear && args.gender === "male") || (!yangYear && args.gender === "female");

  const startAge = args.startAge ?? estimateStartAge(args.solarBirthDate, forward);
  const steps = args.steps ?? 8;

  return rotateMonthPillar(args.pillars.month.gan, args.pillars.month.zhi, forward, steps).map(
    (sb, i) => ({
      index: i + 1,
      stem: sb.stem,
      branch: sb.branch,
      pillar: `${sb.stem}${sb.branch}`,
      startAge: startAge + i * 10,
      endAge: startAge + (i + 1) * 10 - 1,
    }),
  );
}

/**
 * 月柱推进 N 步（顺/逆）
 */
export function rotateMonthPillar(
  startStem: Stem,
  startBranch: Branch,
  forward: boolean,
  steps: number,
): Array<{ stem: Stem; branch: Branch }> {
  const stemIdx = TEN_STEMS.indexOf(startStem);
  const branchIdx = TWELVE_BRANCHES.indexOf(startBranch);
  const out: Array<{ stem: Stem; branch: Branch }> = [];
  for (let i = 0; i < steps; i++) {
    // 大运是月柱的下一柱开始（i=0 即下一个月柱），不是月柱本身
    const offset = forward ? i + 1 : -(i + 1);
    const sIdx = (((stemIdx + offset) % 10) + 10) % 10;
    const bIdx = (((branchIdx + offset) % 12) + 12) % 12;
    out.push({ stem: TEN_STEMS[sIdx]!, branch: TWELVE_BRANCHES[bIdx]! });
  }
  return out;
}

/**
 * 起运估算：粗略版，根据出生日距离月初/月末的天数除以 3。
 * 精确版需 lunar-javascript 拿节气日，这是 V2.1 的 follow-up。
 */
function estimateStartAge(birthDate: Date, forward: boolean): number {
  const day = birthDate.getDate();
  // 简化：月内 1-30 日，按月中日 15 的距离决定
  const distance = forward ? Math.max(0, 30 - day) : day;
  // 距下/上一节气大约 distance 天 → 3 天 = 1 岁
  return Math.max(1, Math.round(distance / 3));
}

// ============ 流年 (M3.9) ============

export interface LiunianStep {
  year: number;
  stem: Stem;
  branch: Branch;
  pillar: string;
  /** 相对中心年的偏移（-2 / -1 / 0 / +1 / +2） */
  offset: number;
}

export interface ComputeLiunianArgs {
  centerYear: number;
  /** 取年数（默认 5：中心 + 前 2 + 后 2） */
  span?: 1 | 3 | 5;
}

/**
 * 公历年 → 年柱
 *
 * 基准：1984 年是 甲子（gz index 0），之后每年 +1（mod 60）
 */
export function yearToPillar(year: number): { stem: Stem; branch: Branch } {
  // 1984 = 甲子（index 0）
  const offset = ((year - 1984) % 60 + 60) % 60;
  const stem = TEN_STEMS[offset % 10]!;
  const branch = TWELVE_BRANCHES[offset % 12]!;
  return { stem, branch };
}

export function computeLiunian(args: ComputeLiunianArgs): LiunianStep[] {
  const span = args.span ?? 5;
  const half = Math.floor(span / 2);
  const out: LiunianStep[] = [];
  for (let off = -half; off <= half; off++) {
    const y = args.centerYear + off;
    const { stem, branch } = yearToPillar(y);
    out.push({
      year: y,
      stem,
      branch,
      pillar: `${stem}${branch}`,
      offset: off,
    });
  }
  return out;
}
