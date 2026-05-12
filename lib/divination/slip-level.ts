/**
 * 签等级体系 — 6 级（V1.0 需求对齐）
 *
 * 上上 / 上吉 / 吉 / 平 / 渐顺 / 慎行
 *
 * 100 签分布：
 *   1-10 上上 (10签)
 *   11-30 上吉 (20签)
 *   31-55 吉 (25签)
 *   56-80 平 (25签)
 *   81-95 渐顺 (15签)
 *   96-100 慎行 (5签)
 */

export type SlipLevel = "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";

export const SLIP_LEVELS: readonly SlipLevel[] = [
  "上上",
  "上吉",
  "吉",
  "平",
  "渐顺",
  "慎行",
] as const;

export function isSlipLevel(x: unknown): x is SlipLevel {
  return typeof x === "string" && SLIP_LEVELS.includes(x as SlipLevel);
}
