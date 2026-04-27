import type { Intent } from "@/types/domain";
import { matchKeyword, KEYWORD_PATTERNS } from "./intent-keywords";

export interface KeywordResult {
  readonly intent: Intent;
  readonly matched: string | null;
}

export type IntentSource = "keyword" | "llm" | "fallback";

export interface IntentClassification {
  readonly intent: Intent;
  readonly confidence: number;
  readonly source: IntentSource;
}

/** LLM 兜底注入点。返回 null 表示模型给不出有效分类。 */
export type LlmIntentCall = (text: string) => Promise<{ intent: Intent } | null>;

/**
 * 关键词层意图分类（M2.2）
 *
 * - 命中关键词 → { intent, matched }
 * - 未命中 → { intent: "chat", matched: null }（chat 是回退，不是关键词命中）
 *
 * 关键词数据集中在 lib/ai/intent-keywords.ts，本文件只做调度。
 */
export function classifyByKeyword(text: string): KeywordResult {
  const hit = matchKeyword(text);
  if (hit) return { intent: hit.intent, matched: hit.matched };
  return { intent: "chat", matched: null };
}

/**
 * 同步 hint / keyword 调度（不走 LLM）
 *
 * - opts.hint 强制返回（按钮点击 / 上下文锁定，绕开关键词）
 * - 否则走 classifyByKeyword
 */
export function classifyIntentSync(text: string, opts?: { hint?: Intent }): Intent {
  if (opts?.hint) return opts.hint;
  return classifyByKeyword(text).intent;
}

/**
 * 异步意图分类（M2.3 — keyword + LLM 兜底）
 *
 * - 第一层：关键词命中 → confidence=1, source="keyword"
 * - 第二层：注入 llmCall 调用模型 → confidence=0.85, source="llm"
 * - 第三层：llmCall 缺省 / 失败 / 返回 null / 非法 intent → confidence=0/0.5, source="fallback"
 *
 * llmCall 用注入而非内部 import 是为了：
 *  - intent.ts 保持 lib 纯，不带 server-only side-effect
 *  - 单元测试可直接 mock 一个简单 fn 而不必 mock 整条 chat 调用栈
 *
 * 真实生产入口在 lib/ai/intent-classifier.ts，那边把 chat() 装进 llmCall 一并注入。
 */
export async function classifyIntent(
  text: string,
  opts?: { llmCall?: LlmIntentCall; hint?: Intent },
): Promise<IntentClassification> {
  if (opts?.hint) {
    return { intent: opts.hint, confidence: 1, source: "keyword" };
  }
  if (!text || text.trim().length === 0) {
    return { intent: "chat", confidence: 0, source: "fallback" };
  }

  const kw = classifyByKeyword(text);
  if (kw.matched !== null) {
    return { intent: kw.intent, confidence: 1, source: "keyword" };
  }

  if (!opts?.llmCall) {
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  }

  try {
    const result = await opts.llmCall(text);
    if (result && isValidIntent(result.intent)) {
      return { intent: result.intent, confidence: 0.85, source: "llm" };
    }
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("classifyIntent llmCall 失败", err);
    }
    return { intent: "chat", confidence: 0, source: "fallback" };
  }
}

const VALID_INTENTS: readonly Intent[] = [
  "chat",
  "divination",
  "dream",
  "bazi",
  "meihua",
] as const;

function isValidIntent(s: string): s is Intent {
  return (VALID_INTENTS as readonly string[]).includes(s);
}

/**
 * V1.0 旧 INTENT_RULES 视图（按 intent 聚合关键词，兼容旧测试 / 调试）
 */
export const INTENT_RULES: ReadonlyArray<{ intent: Intent; keywords: readonly string[] }> =
  (() => {
    const map = new Map<Intent, string[]>();
    for (const rule of KEYWORD_PATTERNS) {
      const key = rule.intent;
      const arr = map.get(key) ?? [];
      arr.push(typeof rule.pattern === "string" ? rule.pattern : rule.pattern.source);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([intent, keywords]) => ({ intent, keywords }));
  })();
