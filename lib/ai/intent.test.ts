import { describe, it, expect } from "vitest";
import { classifyIntent, INTENT_RULES } from "./intent";

describe("classifyIntent (规则层)", () => {
  describe("divination 抽签", () => {
    it("'我要抽灵签' → divination", () => {
      expect(classifyIntent("我要抽灵签")).toBe("divination");
    });
    it("'抽支签看看' → divination", () => {
      expect(classifyIntent("抽支签看看")).toBe("divination");
    });
    it("'去庙里求签了' → divination", () => {
      expect(classifyIntent("去庙里求签了")).toBe("divination");
    });
  });

  describe("dream 解梦", () => {
    it("'我梦见好多水' → dream", () => {
      expect(classifyIntent("我梦见好多水")).toBe("dream");
    });
    it("'帮我解梦' → dream", () => {
      expect(classifyIntent("帮我解梦")).toBe("dream");
    });
    it("'昨晚做了个梦' → dream", () => {
      expect(classifyIntent("昨晚做了个梦")).toBe("dream");
    });
  });

  describe("bazi 八字", () => {
    it("'看看我八字' → bazi", () => {
      expect(classifyIntent("看看我八字")).toBe("bazi");
    });
    it("'帮我排盘' → bazi", () => {
      expect(classifyIntent("帮我排盘")).toBe("bazi");
    });
  });

  describe("meihua 梅花易数", () => {
    it("'起一卦' → meihua", () => {
      expect(classifyIntent("起一卦")).toBe("meihua");
    });
    it("'梅花易数算一下' → meihua", () => {
      expect(classifyIntent("梅花易数算一下")).toBe("meihua");
    });
    it("'卜一卦看看' → meihua", () => {
      expect(classifyIntent("卜一卦看看")).toBe("meihua");
    });
    it("'用梅花算一下吧' → meihua（先 meihua 后 bazi 顺序）", () => {
      expect(classifyIntent("用梅花算一下吧")).toBe("meihua");
    });
  });

  describe("chat 兜底", () => {
    it("'今天天气怎么样' → chat", () => {
      expect(classifyIntent("今天天气怎么样")).toBe("chat");
    });
    it("'你好' → chat", () => {
      expect(classifyIntent("你好")).toBe("chat");
    });
    it("空字符串 → chat", () => {
      expect(classifyIntent("")).toBe("chat");
    });
  });

  describe("hint 强制覆盖", () => {
    it("hint 优先于关键词", () => {
      expect(classifyIntent("any text", { hint: "meihua" })).toBe("meihua");
    });
    it("hint 即使匹配不到关键词也返回 hint", () => {
      expect(classifyIntent("blah blah", { hint: "bazi" })).toBe("bazi");
    });
  });

  describe("规则结构", () => {
    it("INTENT_RULES 含 4 类（chat 是兜底，无关键词规则）", () => {
      const intents = INTENT_RULES.map((r) => r.intent);
      expect(intents).toContain("divination");
      expect(intents).toContain("dream");
      expect(intents).toContain("bazi");
      expect(intents).toContain("meihua");
    });
  });
});
