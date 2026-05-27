import {
  ALL_FORBIDDEN,
  FORBIDDEN_CORE,
  FORBIDDEN_DIVINATION_EXTRA,
} from "./prompts/forbidden-words";
import { stripThinkChain } from "./strip-think-chain";

export { stripThinkChain };

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
 * 替换禁词为柔和说法 + （可选）去掉 Markdown 装饰 + 剥离思考链
 *
 * 默认会 strip # / **（chat 等路径）。梅花《测算结果解读》需保留 Markdown，
 * 调用时传 `preserveMarkdown: true`。
 *
 * Prompt 已经禁用 # / ## / ### 和 ** **，但 DeepSeek 偶尔仍会写出
 * （训练语料里教科书风格强烈）。持久化前最后一道清扫，避免 UI 上
 * 出现裸的 "### 火旺耗身" 标题。
 *
 * 思考链剥离（2026-05-06）：
 *   v4 Pro 偶尔会把内部 reasoning 段以 <think>...</think> 或 [思考]...[/思考]
 *   或行首"思考过程：" 形式漏到 textStream 里（尤其 thinking: enabled 的
 *   bazi/meihua 长 prompt）。统一在写库 / 透客户端前剥掉。
 *
 * @param text AI 原始输出
 * @param scope core (chat) | divination (含开源签强词)
 */
export interface SanitizeAiOutputOptions {
  /** 为 true 时不剥离 # 标题与 ** 加粗（梅花解读等 Markdown 报告） */
  preserveMarkdown?: boolean;
}

export function sanitizeAiOutput(
  text: string,
  scope: "core" | "divination" = "core",
  options?: SanitizeAiOutputOptions,
): SanitizeResult {
  const list = scope === "divination" ? ALL_FORBIDDEN : FORBIDDEN_CORE;
  const extraDream = ["凶兆", "不祥"] as const;
  const all = scope === "divination" ? [...list, ...extraDream] : [...list, ...extraDream];

  let cleaned = stripThinkChain(text);
  if (!options?.preserveMarkdown) {
    cleaned = stripMarkdownDecoration(cleaned);
  }
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


/**
 * 去掉 AI 输出里残留的 Markdown 装饰：
 *   - 行首 #+ 空格 → 删（标题）
 *   - **xxx** → xxx（加粗）
 *   - __xxx__ → xxx（替代加粗）
 *
 * 保留：行内 [方括号标签] / 数字列表 / 中文标点 / 表情符号
 */
export function stripMarkdownDecoration(text: string): string {
  return text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")  // 行首标题
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")    // **加粗**
    .replace(/__([^_\n]+)__/g, "$1");       // __加粗__
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
