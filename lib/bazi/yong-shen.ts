import type { BaziPillars } from "@/types/domain";
import { wuxingOf, type Wuxing, SHENG_CYCLE, KE_CYCLE } from "./stems-branches";
import { HIDDEN_STEMS } from "./stems-branches";

/**
 * 格局判断 + 用神锁定 (M3.10, spec §5.5)
 *
 * 输出：{ gejuType, yongShen, reason }
 *
 * 简化算法：
 *   1. 计算日主五行强度 (0-100)：
 *      - 同党（比劫 + 印）权重正
 *      - 异党（食伤 + 财 + 官杀）权重负
 *      - 月令权重 ×3，日支 ×2，年/时支 ×1
 *      - 天干权重 ×0.5
 *   2. score < 30 → 身弱：用印（生我五行）+ 比劫（同党）
 *      score > 70 → 身强：用财（我克）/ 官（克我）/ 食伤（我生）
 *      30-70 → 中和：用调候（看月令偏寒暖）
 *   3. 极端从格（< 10 / > 90）→ 从弱 / 从强格，用神反向锁
 *
 * 这是简化版，V2.1 升级真正的格局判断（伤官配印 / 杀印相生 等）。
 */

export type GejuType = "身强" | "身弱" | "中和" | "从弱" | "从强";

export interface YongShenResult {
  gejuType: GejuType;
  yongShen: Wuxing; // 主用神
  jiShen: Wuxing | null; // 忌神（与用神相反）
  strength: number; // 0-100
  reason: string;
}

/**
 * 5 月令权重位置：日支、月支、年支、时支 + 4 天干
 */
function scoreDayMasterStrength(args: {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
}): number {
  const dayWuxing = wuxingOf(args.pillars.day.gan);
  const supportSet = new Set<Wuxing>([
    dayWuxing,
    inverseSheng(dayWuxing), // 生我
  ]);

  // 收集每柱五行（含藏干）
  type Slot = { wuxing: Wuxing; weight: number };
  const slots: Slot[] = [];
  // 月支权重 3
  for (const s of HIDDEN_STEMS[args.pillars.month.zhi]) {
    slots.push({ wuxing: wuxingOf(s), weight: 3 });
  }
  // 日支权重 2
  for (const s of HIDDEN_STEMS[args.pillars.day.zhi]) {
    slots.push({ wuxing: wuxingOf(s), weight: 2 });
  }
  // 年/时支权重 1
  for (const s of HIDDEN_STEMS[args.pillars.year.zhi]) {
    slots.push({ wuxing: wuxingOf(s), weight: 1 });
  }
  for (const s of HIDDEN_STEMS[args.pillars.hour.zhi]) {
    slots.push({ wuxing: wuxingOf(s), weight: 1 });
  }
  // 天干权重 0.5（除日干）
  slots.push({ wuxing: wuxingOf(args.pillars.year.gan), weight: 0.5 });
  slots.push({ wuxing: wuxingOf(args.pillars.month.gan), weight: 0.5 });
  slots.push({ wuxing: wuxingOf(args.pillars.hour.gan), weight: 0.5 });

  let support = 0;
  let oppose = 0;
  for (const s of slots) {
    if (supportSet.has(s.wuxing)) support += s.weight;
    else oppose += s.weight;
  }

  const total = support + oppose;
  if (total === 0) return 50;
  return Math.round((support / total) * 100);
}

/**
 * 反生：B → A 的 A（即 SHENG_CYCLE 反向查找）
 */
function inverseSheng(target: Wuxing): Wuxing {
  for (const [from, to] of Object.entries(SHENG_CYCLE) as Array<[Wuxing, Wuxing]>) {
    if (to === target) return from;
  }
  return target;
}

/**
 * 我克的五行（财）
 */
function wuxingKe(from: Wuxing): Wuxing {
  return KE_CYCLE[from];
}

/**
 * 克我的五行（官杀）
 */
function wuxingKeBy(target: Wuxing): Wuxing {
  for (const [from, to] of Object.entries(KE_CYCLE) as Array<[Wuxing, Wuxing]>) {
    if (to === target) return from;
  }
  return target;
}

/**
 * 我生的五行（食伤）
 */
function wuxingSheng(from: Wuxing): Wuxing {
  return SHENG_CYCLE[from];
}

export interface DetermineYongShenArgs {
  pillars: BaziPillars;
  fiveElements: Record<Wuxing, number>;
}

export function determineYongShen(args: DetermineYongShenArgs): YongShenResult {
  const dayWuxing = wuxingOf(args.pillars.day.gan);
  const strength = scoreDayMasterStrength(args);

  // 极端从格
  if (strength < 10) {
    return {
      gejuType: "从弱",
      yongShen: wuxingKeBy(dayWuxing), // 从异党最强
      jiShen: dayWuxing,
      strength,
      reason: "日主无根全失，从异党之势，用克我（官杀）以顺",
    };
  }
  if (strength > 90) {
    return {
      gejuType: "从强",
      yongShen: dayWuxing, // 顺自身
      jiShen: wuxingKeBy(dayWuxing),
      strength,
      reason: "日主极旺无制，从一专之气，用比劫顺其势",
    };
  }

  if (strength < 30) {
    return {
      gejuType: "身弱",
      yongShen: inverseSheng(dayWuxing), // 印
      jiShen: wuxingKe(dayWuxing),
      strength,
      reason: "日主能量偏弱，宜用生我之印（与同党比劫）扶持",
    };
  }
  if (strength > 70) {
    return {
      gejuType: "身强",
      yongShen: wuxingKe(dayWuxing), // 财
      jiShen: inverseSheng(dayWuxing),
      strength,
      reason: "日主能量偏强，宜用我克之财（或官杀制衡）泄秀",
    };
  }

  // 30-70 中和：取最缺的五行（调候）
  const allWuxing: Wuxing[] = ["金", "木", "水", "火", "土"];
  let weakest = allWuxing[0]!;
  let weakestCount = args.fiveElements[weakest] ?? 0;
  for (const w of allWuxing) {
    const c = args.fiveElements[w] ?? 0;
    if (c < weakestCount) {
      weakest = w;
      weakestCount = c;
    }
  }
  return {
    gejuType: "中和",
    yongShen: weakest,
    jiShen: null,
    strength,
    reason: `命局五行偏均衡，宜补 ${weakest} 调候`,
  };
}

/**
 * 兼容老 API
 */
export function scoreStrength(args: DetermineYongShenArgs): number {
  return scoreDayMasterStrength(args);
}

export function isWeak(strength: number): boolean {
  return strength < 30;
}

export function isStrong(strength: number): boolean {
  return strength > 70;
}
