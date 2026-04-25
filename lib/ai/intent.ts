import type { Intent } from "@/types/domain";

interface IntentRule {
  intent: Intent;
  keywords: readonly string[];
}

/**
 * 关键词优先级：从前往后，第一条命中即返回。
 * 排序原则：长词优先 / 高歧义关键词靠后（如"算"在 bazi 和 meihua 都用，故 meihua 用更长的"算一卦"）。
 */
const RULES: readonly IntentRule[] = [
  {
    intent: "meihua",
    keywords: [
      "梅花易数",
      "梅花",
      "起一卦",
      "起卦",
      "卜一卦",
      "算一卦",
      "卜卦",
    ],
  },
  {
    intent: "bazi",
    keywords: ["八字", "命盘", "排盘", "看八字", "算命"],
  },
  {
    intent: "dream",
    keywords: ["解梦", "我梦见", "梦到", "做了个梦", "做了梦"],
  },
  {
    intent: "divination",
    keywords: ["抽灵签", "抽签", "抽支签", "求签", "灵签"],
  },
] as const;

/**
 * 规则层意图分类（0 token 路由）
 *
 * - 命中关键词直接路由
 * - 未命中返回 'chat' 兜底
 * - opts.hint 强制返回（用于按钮点击 / 上下文锁定，绕开关键词识别）
 *
 * P2 / V1.1 可在此基础上挂 DeepSeek 兜底分类，但保持本函数纯。
 */
export function classifyIntent(text: string, opts?: { hint?: Intent }): Intent {
  if (opts?.hint) return opts.hint;

  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.intent;
  }
  return "chat";
}

export const INTENT_RULES = RULES;
