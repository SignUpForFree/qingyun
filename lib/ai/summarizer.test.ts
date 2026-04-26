import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./client", () => ({
  chat: vi.fn(async () => ({ text: "用户问八字事业方向，AI 给了四象限建议", tokensUsed: 50 })),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import {
  summarize,
  buildPromptMessages,
  shouldSummarize,
  K_RECENT,
  SUMMARIZE_THRESHOLD,
  SUMMARIZE_INTERVAL,
} from "./summarizer";

describe("常量", () => {
  it("K_RECENT=6 / 阈值=12 / 间隔=4", () => {
    expect(K_RECENT).toBe(6);
    expect(SUMMARIZE_THRESHOLD).toBe(12);
    expect(SUMMARIZE_INTERVAL).toBe(4);
  });
});

describe("buildPromptMessages", () => {
  it("无 summary 时返回 system + 最近 K 条 + 当前 user", () => {
    const recentMsgs = [
      { role: "user" as const, content: "你好" },
      { role: "assistant" as const, content: "你好呀" },
      { role: "user" as const, content: "继续" },
    ];
    const result = buildPromptMessages({
      systemPrompt: "你是 AI",
      summary: null,
      recent: recentMsgs,
      userText: "再说一点",
    });
    expect(result).toEqual([
      { role: "system", content: "你是 AI" },
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好呀" },
      { role: "user", content: "继续" },
      { role: "user", content: "再说一点" },
    ]);
  });

  it("有 summary 时插入第 2 条 system message", () => {
    const result = buildPromptMessages({
      systemPrompt: "你是 AI",
      summary: "之前聊了八字事业",
      recent: [],
      userText: "继续",
    });
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("你是 AI");
    expect(result[1].role).toBe("system");
    expect(result[1].content).toContain("之前聊了八字事业");
    expect(result[2]).toEqual({ role: "user", content: "继续" });
  });

  it("空白 summary 视为无（不插 system 第 2 条）", () => {
    const result = buildPromptMessages({
      systemPrompt: "S",
      summary: "   ",
      recent: [],
      userText: "u",
    });
    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ role: "system", content: "S" });
    expect(result[1]).toEqual({ role: "user", content: "u" });
  });
});

describe("shouldSummarize", () => {
  it("11 条 / 0 摘要 → false（未到阈值）", () => {
    expect(shouldSummarize(11, 0)).toBe(false);
  });
  it("12 条 / 0 摘要 → true（首次到阈值）", () => {
    expect(shouldSummarize(12, 0)).toBe(true);
  });
  it("15 条 / 12 摘要 → false（间隔=3 < 4）", () => {
    expect(shouldSummarize(15, 12)).toBe(false);
  });
  it("16 条 / 12 摘要 → true（间隔=4 满足）", () => {
    expect(shouldSummarize(16, 12)).toBe(true);
  });
});

describe("summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("消息少于阈值时跳过", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb([
        { role: "user", content: "1", created_at: "2026-04-26T01:00:00Z" },
        { role: "assistant", content: "2", created_at: "2026-04-26T01:01:00Z" },
      ]),
    );
    const result = await summarize("conv-1");
    expect(result).toBe("skipped");
  });

  it("消息 ≥ 阈值时调用 chat 并写库", async () => {
    const { chat } = await import("./client");
    const { getDb } = await import("@/lib/db/client");
    const updateMock = vi.fn();
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb(
        Array.from({ length: 14 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg ${i}`,
          created_at: `2026-04-26T01:${String(i).padStart(2, "0")}:00Z`,
        })),
        updateMock,
      ),
    );
    const result = await summarize("conv-1");
    expect(result).toBe("ok");
    expect(chat).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalled();
  });

  it("chat 抛错时返回 error 不抛", async () => {
    const { chat } = await import("./client");
    (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error("ai down"),
    );
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb(
        Array.from({ length: 14 }, () => ({
          role: "user",
          content: "m",
          created_at: "2026-04-26T01:00:00Z",
        })),
      ),
    );
    const result = await summarize("conv-1");
    expect(result).toBe("error");
  });
});

interface FakeMsg {
  role: string;
  content: string;
  created_at: string;
}

function makeFakeDb(msgs: FakeMsg[], updateMock?: () => void) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(msgs),
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => {
          if (updateMock) updateMock();
          return Promise.resolve();
        },
      }),
    }),
  };
}
