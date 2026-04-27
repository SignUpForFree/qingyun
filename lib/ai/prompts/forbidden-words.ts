/**
 * 禁词锁单一 source of truth (M3.29)
 *
 * - CORE：所有 prompt 必带（聊天 + 占卜均强制）
 * - DIVINATION_EXTRA：占卜场景额外加（解签/八字/梅花/解梦）
 *
 * 用于：
 *   - lib/chat/router.ts  → CORE
 *   - lib/ai/prompts/slip-interpret.ts → CORE + DIVINATION_EXTRA
 *   - lib/ai/prompts/fortune-reading.ts → CORE
 *   - lib/ai/prompts/bazi-interpret.ts → CORE + DIVINATION_EXTRA
 *   - lib/ai/prompts/meihua-interpret.ts → CORE + DIVINATION_EXTRA
 *
 * 同步更新所有调用点的 prompt 字符串：M3.29 review 已完成。
 */

export const FORBIDDEN_CORE = [
  "大凶",
  "倒霉",
  "厄运",
  "命中注定",
  "注定",
  "必然",
] as const;

/** 占卜专用：开源签词中常见的"硬词"，prompt 一层强制软化 */
export const FORBIDDEN_DIVINATION_EXTRA = ["慎行", "凶险"] as const;

/** 全部禁词 */
export const ALL_FORBIDDEN = [...FORBIDDEN_CORE, ...FORBIDDEN_DIVINATION_EXTRA] as const;

/** 渲染成 prompt 行："禁词：A / B / C / ..." */
export function renderForbiddenLine(extra = false): string {
  const list = extra ? ALL_FORBIDDEN : FORBIDDEN_CORE;
  return `禁词：${list.join(" / ")}。`;
}

export const SOFT_REPLACEMENT_HINT =
  "负面信号一律转柔和说法（先慢一步、沉住气、宜稳、留白多一些、不必急）。";
