import { describe, expect, it } from "vitest";
import {
  classifyByKeyword,
  classifyIntentSync,
  INTENT_RULES,
} from "./intent";

/**
 * M2.2 — 50+ 样本 keyword 分类回归集
 * 按 5 类 intent 各列 10+ 句，命中应等于 expected。
 * chat 类是 fallback（matched=null），覆盖纯闲聊和无关键词输入。
 */
const SAMPLES: ReadonlyArray<readonly [string, "divination" | "dream" | "bazi" | "meihua" | "chat"]> = [
  // divination 12
  ["我想抽签", "divination"],
  ["求个签看看", "divination"],
  ["最近运气怎么办", "divination"],
  ["我要抽灵签", "divination"],
  ["抽支签看看", "divination"],
  ["抽个签吧", "divination"],
  ["去庙里求签了", "divination"],
  ["求一签问问婚姻", "divination"],
  ["想抽个签问问事业", "divination"],
  ["求签解惑", "divination"],
  ["看看签文", "divination"],
  ["最近运气特别差", "divination"],

  // dream 11
  ["梦到了已故的爷爷", "dream"],
  ["昨晚梦见考试", "dream"],
  ["我梦见好多水", "dream"],
  ["帮我解梦", "dream"],
  ["昨晚做了个梦", "dream"],
  ["做了一个奇怪的梦", "dream"],
  ["昨晚做了个噩梦", "dream"],
  ["梦境很真实", "dream"],
  ["帮我解个梦", "dream"],
  ["梦到掉牙齿", "dream"],
  ["想圆梦", "dream"],

  // bazi 11
  ["帮我看八字", "bazi"],
  ["排盘", "bazi"],
  ["大运怎么走", "bazi"],
  ["看看我八字", "bazi"],
  ["帮我排盘", "bazi"],
  ["想了解我的命格", "bazi"],
  ["看下命盘", "bazi"],
  ["流年怎么样", "bazi"],
  ["用神是什么", "bazi"],
  ["我要八字解读", "bazi"],
  ["纳音五行", "bazi"],

  // meihua 11
  ["测一下今天", "meihua"],
  ["起一卦", "meihua"],
  ["梅花易数算一下", "meihua"],
  ["卜一卦看看", "meihua"],
  ["用梅花算一下吧", "meihua"],
  ["数字测算", "meihua"],
  ["起卦看看", "meihua"],
  ["占一卦问问", "meihua"],
  ["三个数测算", "meihua"],
  ["我要测算", "meihua"],
  ["卜卦看姻缘", "meihua"],

  // chat 12
  ["天气怎么样", "chat"],
  ["你好", "chat"],
  ["在吗", "chat"],
  ["谢谢你", "chat"],
  ["你叫什么名字", "chat"],
  ["最近工作压力大", "chat"],
  ["想聊聊天", "chat"],
  ["心情有点低落", "chat"],
  ["你能做什么", "chat"],
  ["介绍一下你自己", "chat"],
  ["这个城市怎么样", "chat"],
  ["", "chat"],
];

describe("classifyByKeyword (M2.2 — 50+ 样本)", () => {
  it("样本总数 ≥ 50", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(50);
  });

  it.each(SAMPLES)('"%s" → %s', (text, expected) => {
    expect(classifyByKeyword(text).intent).toBe(expected);
  });

  it("chat 样本 matched 必须为 null（仅 fallback，不算关键词命中）", () => {
    for (const [text, expected] of SAMPLES) {
      if (expected === "chat") {
        const r = classifyByKeyword(text);
        expect(r.matched).toBeNull();
      }
    }
  });

  it("非 chat 样本 matched 必须非 null（命中关键词）", () => {
    for (const [text, expected] of SAMPLES) {
      if (expected !== "chat") {
        const r = classifyByKeyword(text);
        expect(r.matched).not.toBeNull();
      }
    }
  });
});

describe("classifyIntentSync (hint 强制 / 关键词回落)", () => {
  it("hint 优先于关键词", () => {
    expect(classifyIntentSync("我要抽灵签", { hint: "meihua" })).toBe("meihua");
  });

  it("无 hint 走关键词", () => {
    expect(classifyIntentSync("帮我看八字")).toBe("bazi");
  });

  it("空字符串 → chat", () => {
    expect(classifyIntentSync("")).toBe("chat");
  });

  it("纯闲聊 → chat", () => {
    expect(classifyIntentSync("今天天气怎么样")).toBe("chat");
  });
});

describe("INTENT_RULES 结构", () => {
  it("覆盖 4 个非 chat intent", () => {
    const intents = INTENT_RULES.map((r) => r.intent);
    expect(intents).toContain("divination");
    expect(intents).toContain("dream");
    expect(intents).toContain("bazi");
    expect(intents).toContain("meihua");
  });

  it("每类至少 10 个关键词条目", () => {
    for (const rule of INTENT_RULES) {
      expect(rule.keywords.length).toBeGreaterThanOrEqual(10);
    }
  });
});
