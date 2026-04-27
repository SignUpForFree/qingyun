import type { Intent } from "@/types/domain";

export interface KeywordPattern {
  readonly pattern: string | RegExp;
  readonly intent: Intent;
}

/**
 * 关键词样本库（M2.2）— 5 类共 80+ 条规则。
 *
 * 顺序原则：
 * 1. 显式 "我要 X" 强信号正则放最前（避免被弱关键词截胡）
 * 2. 长词优先、特异词优先（"梅花易数" > "梅花" > "起卦"）
 * 3. 多语义弱信号靠后（"运气" 既可能 chat 也可能 divination）
 *
 * chat 不列关键词 — 全部 miss 时由 classifyByKeyword 回落为 chat。
 */
export const KEYWORD_PATTERNS: readonly KeywordPattern[] = [
  // ============ explicit 我要 X 强信号（最高优先） ============
  { pattern: /^我要(抽签|抽灵签|抽支签|抽个签|求签)/, intent: "divination" },
  { pattern: /^我要\s*(AI)?\s*解梦/i, intent: "dream" },
  { pattern: /^我要(进行)?\s*(AI)?\s*八字解读/i, intent: "bazi" },
  { pattern: /^我要(进行)?(数字)?(测算|起卦|算一卦|卜卦)/, intent: "meihua" },

  // ============ meihua 梅花易数（特异 16） ============
  { pattern: "梅花易数", intent: "meihua" },
  { pattern: "梅花", intent: "meihua" },
  { pattern: "起一卦", intent: "meihua" },
  { pattern: "起卦看看", intent: "meihua" },
  { pattern: "起卦", intent: "meihua" },
  { pattern: "卜一卦", intent: "meihua" },
  { pattern: "卜卦", intent: "meihua" },
  { pattern: "算一卦", intent: "meihua" },
  { pattern: "占一卦", intent: "meihua" },
  { pattern: "占卦", intent: "meihua" },
  { pattern: "数字测算", intent: "meihua" },
  { pattern: "数字起卦", intent: "meihua" },
  { pattern: "测一下今天", intent: "meihua" },
  { pattern: "测一下这事", intent: "meihua" },
  { pattern: "测一下", intent: "meihua" },
  { pattern: "三个数", intent: "meihua" },

  // ============ bazi 八字（特异 17） ============
  { pattern: "八字解读", intent: "bazi" },
  { pattern: "看看我八字", intent: "bazi" },
  { pattern: "帮我看八字", intent: "bazi" },
  { pattern: "看八字", intent: "bazi" },
  { pattern: "八字", intent: "bazi" },
  { pattern: "排盘", intent: "bazi" },
  { pattern: "排个盘", intent: "bazi" },
  { pattern: "命盘", intent: "bazi" },
  { pattern: "看下命盘", intent: "bazi" },
  { pattern: "命格", intent: "bazi" },
  { pattern: "大运怎么走", intent: "bazi" },
  { pattern: "大运", intent: "bazi" },
  { pattern: "流年", intent: "bazi" },
  { pattern: "看看我命", intent: "bazi" },
  { pattern: "用神", intent: "bazi" },
  { pattern: "日主", intent: "bazi" },
  { pattern: "纳音", intent: "bazi" },

  // ============ dream 解梦（特异 15） ============
  { pattern: /帮我解.{0,3}梦/, intent: "dream" },
  { pattern: /解.{0,2}梦/, intent: "dream" },
  { pattern: "帮我解梦", intent: "dream" },
  { pattern: "解梦", intent: "dream" },
  { pattern: "我梦见", intent: "dream" },
  { pattern: "梦见", intent: "dream" },
  { pattern: "梦到了", intent: "dream" },
  { pattern: "梦到", intent: "dream" },
  { pattern: "做了个梦", intent: "dream" },
  { pattern: "做了一个奇怪的梦", intent: "dream" },
  { pattern: "做了梦", intent: "dream" },
  { pattern: "昨晚梦", intent: "dream" },
  { pattern: "昨晚做了", intent: "dream" },
  { pattern: "做梦", intent: "dream" },
  { pattern: "梦境", intent: "dream" },
  { pattern: "梦解析", intent: "dream" },
  { pattern: "圆梦", intent: "dream" },

  // ============ divination 抽签（特异 16+） ============
  { pattern: /抽.{0,2}签/, intent: "divination" },
  { pattern: "抽灵签", intent: "divination" },
  { pattern: "抽支签", intent: "divination" },
  { pattern: "抽个签", intent: "divination" },
  { pattern: "我想抽签", intent: "divination" },
  { pattern: "想抽个签", intent: "divination" },
  { pattern: "抽签", intent: "divination" },
  { pattern: "求支签", intent: "divination" },
  { pattern: "求个签", intent: "divination" },
  { pattern: "求签", intent: "divination" },
  { pattern: "灵签", intent: "divination" },
  { pattern: "去庙里求签", intent: "divination" },
  { pattern: "签问问", intent: "divination" },
  { pattern: "求一签", intent: "divination" },
  { pattern: "签文", intent: "divination" },
  { pattern: "运气怎么办", intent: "divination" },
  { pattern: "最近运气", intent: "divination" },
] as const;

export interface KeywordHit {
  readonly intent: Intent;
  readonly matched: string;
}

/**
 * 顺序匹配：第一个命中即返回（pattern 顺序定义优先级）
 *
 * - 字符串 pattern → text.includes(pattern)
 * - RegExp pattern → pattern.test(text)
 *
 * 命中返回 KeywordHit，全 miss 返回 null（由调用方决定回落）
 */
export function matchKeyword(text: string): KeywordHit | null {
  if (!text || text.trim().length === 0) return null;
  const t = text.trim();

  for (const rule of KEYWORD_PATTERNS) {
    if (typeof rule.pattern === "string") {
      if (t.includes(rule.pattern)) {
        return { intent: rule.intent, matched: rule.pattern };
      }
    } else {
      if (rule.pattern.test(t)) {
        return { intent: rule.intent, matched: rule.pattern.source };
      }
    }
  }
  return null;
}
