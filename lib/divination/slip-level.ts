/**
 * 签等级映射：seed 6 级 → spec §4.4 wire 5 级 (M3.1)
 *
 * docx 100 签源用 6 级（上上/上吉/吉/平/渐顺/慎行）。
 * spec §4.4 + DB schema + chat-ui Zod 用 5 级（上上/上吉/中吉/中平/下下）。
 *
 * 映射：吉 → 中吉；平 → 中平；渐顺 → 中平；慎行 → 下下。
 *
 * 这层 helper 隔离两套术语，既保留源数据不动，又让 wire 协议稳定。
 */

export type SeedLevel = "上上" | "上吉" | "吉" | "平" | "渐顺" | "慎行";
export type SpecLevel = "上上" | "上吉" | "中吉" | "中平" | "下下";

const MAP: Record<SeedLevel, SpecLevel> = {
  上上: "上上",
  上吉: "上吉",
  吉: "中吉",
  平: "中平",
  渐顺: "中平",
  慎行: "下下",
};

export const SPEC_LEVELS: readonly SpecLevel[] = [
  "上上",
  "上吉",
  "中吉",
  "中平",
  "下下",
] as const;

export function seedToSpecLevel(level: SeedLevel | SpecLevel): SpecLevel {
  if (SPEC_LEVELS.includes(level as SpecLevel)) return level as SpecLevel;
  if (level in MAP) return MAP[level as SeedLevel];
  return "中平"; // 兜底，不抛
}

export function isSpecLevel(x: unknown): x is SpecLevel {
  return typeof x === "string" && SPEC_LEVELS.includes(x as SpecLevel);
}
