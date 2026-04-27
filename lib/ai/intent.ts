import type { Intent } from "@/types/domain";
import { matchKeyword, KEYWORD_PATTERNS } from "./intent-keywords";

export interface KeywordResult {
  readonly intent: Intent;
  readonly matched: string | null;
}

/**
 * 关键词层意图分类（M2.2）
 *
 * - 命中关键词 → { intent, matched }
 * - 未命中 → { intent: "chat", matched: null }（chat 是回退，不是关键词命中）
 *
 * 关键词数据集中在 lib/ai/intent-keywords.ts，本文件只做调度。
 * LLM 兜底接 lib/ai/intent-classifier.ts 的 classifyIntent。
 */
export function classifyByKeyword(text: string): KeywordResult {
  const hit = matchKeyword(text);
  if (hit) return { intent: hit.intent, matched: hit.matched };
  return { intent: "chat", matched: null };
}

/**
 * 同步 hint / keyword 调度（V1.0 兼容）
 *
 * - opts.hint 强制返回（按钮点击 / 上下文锁定，绕开关键词）
 * - 否则走 classifyByKeyword
 *
 * 异步 LLM 兜底版在 lib/ai/intent-classifier.ts。
 */
export function classifyIntentSync(text: string, opts?: { hint?: Intent }): Intent {
  if (opts?.hint) return opts.hint;
  return classifyByKeyword(text).intent;
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
