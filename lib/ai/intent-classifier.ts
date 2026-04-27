import "server-only";
import { classifyIntent as classifyIntentCore, type LlmIntentCall, type IntentClassification } from "./intent";
import { chat } from "./client";
import type { Intent } from "@/types/domain";

const VALID_INTENTS: readonly Intent[] = [
  "chat",
  "divination",
  "dream",
  "bazi",
  "meihua",
] as const;

const CLASSIFY_SYSTEM_PROMPT = `你是意图分类器。把用户的中文输入归到下列 5 个类别之一，只输出标签词，不输出任何解释：

- divination：用户想抽灵签 / 抽签
- dream：用户想解梦或描述了梦境内容
- bazi：用户想看命盘 / 八字 / 命格 / 大运
- meihua：用户想用梅花易数 / 数字测算占卜某件具体的事
- chat：以上都不是，普通闲聊或其他咨询

只能输出 5 个标签词中的 1 个。不要输出标点和其他字。`;

const CLASSIFIER_TIMEOUT_MS = 5000;

/**
 * 生产 llmCall — 把 chat() 客户端 + 5s 超时 + label 解析包成 LlmIntentCall。
 */
const productionLlmCall: LlmIntentCall = async (text) => {
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
  return intent ? { intent } : null;
};

/**
 * 意图分类器（B 策略 = 关键词 + LLM 兜底）— 生产入口
 *
 * 主逻辑在 lib/ai/intent.ts 的 classifyIntent。这里只负责把
 * production chat 客户端装进 llmCall 注入点。
 */
export async function classifyIntent(text: string): Promise<IntentClassification> {
  return classifyIntentCore(text, { llmCall: productionLlmCall });
}

export type { IntentClassification } from "./intent";
