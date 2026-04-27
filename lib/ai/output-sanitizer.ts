import {
  ALL_FORBIDDEN,
  FORBIDDEN_CORE,
  FORBIDDEN_DIVINATION_EXTRA,
} from "./prompts/forbidden-words";

/**
 * AI 输出兜底净化器 (M3.34)
 *
 * Prompt 已经柔化禁词，但 AI 偶尔仍会写出（开源训练语料里包含古风强词）。
 * 持久化到 messages.content / metadata 之前最后一道墙：
 *
 *   - 替换：硬词 → 柔和说法（"大凶" → "需多留意"）
 *   - 计数：返回命中数，便于路由层 console.warn / metric 上报
 *
 * 不做即时 token 拦截（成本太高且 SSE 回到用户已经"水洒地"），
 * 只做"写盘前清扫"，避免历史对话留下硬词被未来回看放大。
 */

const SOFT_REPLACEMENTS: Record<string, string> = {
  大凶: "需多留意",
  倒霉: "不太顺",
  厄运: "波折",
  命中注定: "趋势如此",
  注定: "目前看",
  必然: "倾向",
  慎行: "稳一些",
  凶险: "需小心",
  凶兆: "提醒",
  不祥: "需留意",
};

export interface SanitizeResult {
  cleaned: string;
  hitCount: number;
  hitWords: string[];
}

/**
 * 替换禁词为柔和说法
 *
 * @param text AI 原始输出
 * @param scope core (chat) | divination (含开源签强词)
 */
export function sanitizeAiOutput(
  text: string,
  scope: "core" | "divination" = "core",
): SanitizeResult {
  const list = scope === "divination" ? ALL_FORBIDDEN : FORBIDDEN_CORE;
  // dream 路由额外两词（凶兆/不祥）— 单独 includes
  const extraDream = ["凶兆", "不祥"] as const;
  const all = scope === "divination" ? [...list, ...extraDream] : [...list, ...extraDream];

  let cleaned = text;
  const hitWords: string[] = [];
  for (const word of all) {
    if (cleaned.includes(word)) {
      hitWords.push(word);
      const replacement = SOFT_REPLACEMENTS[word] ?? "需留意";
      cleaned = cleaned.split(word).join(replacement);
    }
  }
  return {
    cleaned,
    hitCount: hitWords.length,
    hitWords,
  };
}

/** 仅检测，不替换；用于离线 audit */
export function detectForbidden(text: string): string[] {
  const all = [...ALL_FORBIDDEN, "凶兆", "不祥"] as const;
  return all.filter((w) => text.includes(w));
}

export const FORBIDDEN_LIST_FOR_TEST = {
  CORE: FORBIDDEN_CORE,
  DIVINATION_EXTRA: FORBIDDEN_DIVINATION_EXTRA,
};
