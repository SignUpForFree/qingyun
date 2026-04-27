import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./client", () => ({
  chat: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const userText = messages[messages.length - 1].content;
    if (/梦|做梦|梦见/.test(userText)) return { text: "dream", tokensUsed: 5 };
    if (/抽签|签|占|抽支/.test(userText)) return { text: "divination", tokensUsed: 5 };
    if (/八字|命盘|命格|命理/.test(userText)) return { text: "bazi", tokensUsed: 5 };
    if (/算/.test(userText)) return { text: "meihua", tokensUsed: 5 };
    return { text: "chat", tokensUsed: 5 };
  }),
}));

import { classifyIntent } from "./intent-classifier";

describe("classifyIntent (B 策略 = 关键词 + LLM 兜底)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("关键词层（source: keyword）", () => {
    const cases = [
      ["我要抽灵签", "divination"],
      ["我要测算", "meihua"],
      ["我要 AI 解梦", "dream"],
      ["我要八字解读", "bazi"],
      ["抽个签吧", "divination"],
      ["帮我解个梦", "dream"],
      ["看我的八字", "bazi"],
    ] as const;
    for (const [text, expected] of cases) {
      it(`"${text}" → ${expected}`, async () => {
        const r = await classifyIntent(text);
        expect(r.intent).toBe(expected);
        expect(r.source).toBe("keyword");
      });
    }
  });

  describe("LLM 兜底层（source: llm）", () => {
    const cases = [
      ["我做了一个非常奇怪的梦，需要给解读一下", "dream"],
      ["帮我算一下事业运势", "meihua"],
      ["想看看自己的命理", "bazi"],
      ["你好啊轻运", "chat"],
      ["最近工作压力大想聊聊", "chat"],
    ] as const;
    for (const [text, expected] of cases) {
      it(`"${text}" → ${expected}`, async () => {
        const r = await classifyIntent(text);
        expect(r.intent).toBe(expected);
        expect(r.source).toBe("llm");
      });
    }
  });

  describe("LLM 失败 fallback chat", () => {
    it("LLM throw 时返回 chat / source=fallback", async () => {
      const { chat } = await import("./client");
      (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
        new Error("AI down"),
      );
      const r = await classifyIntent("某种乱七八糟的输入");
      expect(r.intent).toBe("chat");
      expect(r.source).toBe("fallback");
    });
  });

  describe("空输入", () => {
    it("空字符串 → chat / fallback", async () => {
      const r = await classifyIntent("");
      expect(r.intent).toBe("chat");
      expect(r.source).toBe("fallback");
    });
  });
});
