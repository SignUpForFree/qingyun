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

/**
 * 关键词层（B 策略 = 关键词 + LLM 兜底）
 *
 * 仅捕获显式高置信度模式：
 * - "我要 X" 显式指令
 * - 不会和 LLM 兜底测试用例冲突的强信号短句（八字 / 解X梦 / 抽X签 等）
 *
 * 模糊措辞（"我做了个梦"、"帮我算一下"、"我的命盘怎么样"）走 LLM，避免误分类。
 */
export function classifyByKeyword(text: string): Intent | null {
  if (!text || text.trim().length === 0) return null;
  const t = text.trim();

  // 显式 "我要 X" 指令（最高优先级）
  if (/^我要(抽签|抽灵签|抽支签|抽个签|求签)/.test(t)) return "divination";
  if (/^我要(进行)?(数字)?(测算|起卦|算一卦)/.test(t)) return "meihua";
  if (/^我要\s*(AI)?\s*解梦/i.test(t)) return "dream";
  if (/^我要(进行)?\s*(AI)?\s*八字解读/i.test(t)) return "bazi";

  // 强信号短句（短词同框）
  if (/抽.{0,2}签|求签|灵签/.test(t)) return "divination";
  if (/解.{0,2}梦|帮我解.{0,3}梦/.test(t)) return "dream";
  if (/八字/.test(t)) return "bazi";

  return null;
}
