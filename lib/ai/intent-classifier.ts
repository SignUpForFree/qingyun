import "server-only";
import { classifyByKeyword } from "./intent";
import { chat } from "./client";
import type { Intent } from "@/types/domain";

const VALID_INTENTS = ["chat", "divination", "dream", "bazi", "meihua"] as const;

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  source: "keyword" | "llm" | "fallback";
}

const CLASSIFY_SYSTEM_PROMPT = `你是意图分类器。把用户的中文输入归到下列 5 个类别之一，只输出标签词，不输出任何解释：

- divination：用户想抽灵签 / 抽签
- dream：用户想解梦或描述了梦境内容
- bazi：用户想看命盘 / 八字 / 命格 / 大运
- meihua：用户想用梅花易数 / 数字测算占卜某件具体的事
- chat：以上都不是，普通闲聊或其他咨询

只能输出 5 个标签词中的 1 个。不要输出标点和其他字。`;

const CLASSIFIER_TIMEOUT_MS = 5000;

/**
 * 意图分类器（B 策略 = 关键词 + LLM 兜底）
 *
 * - 第一层：关键词命中 → 0 token，confidence=1
 * - 第二层：DeepSeek 分类（5s 超时） → confidence=0.85
 * - 第三层：LLM 失败或返回非法标签 → fallback chat
 */
export async function classifyIntent(text: string): Promise<IntentClassification> {
  if (!text || text.trim().length === 0) {
    return { intent: "chat", confidence: 0, source: "fallback" };
  }

  const kw = classifyByKeyword(text);
  if (kw) {
    return { intent: kw, confidence: 1, source: "keyword" };
  }

  try {
    const ai = await Promise.race([
      chat({
        systemPrompt: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 500) }],
        stream: false,
        meta: { conversationId: "intent-classify", userId: "system" },
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("intent classifier timeout")), CLASSIFIER_TIMEOUT_MS),
      ),
    ]);
    const label = ai.text.trim().toLowerCase();
    const intent = VALID_INTENTS.find((i) => label.includes(i));
    if (intent) {
      return { intent, confidence: 0.85, source: "llm" };
    }
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  } catch (e) {
    console.error("intent classifier 失败", e);
    return { intent: "chat", confidence: 0, source: "fallback" };
  }
}
