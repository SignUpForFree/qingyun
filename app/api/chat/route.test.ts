import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/ai/check-rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, used: 0, limit: 30 })),
}));

vi.mock("@/lib/safety/guard", () => ({
  guardTexts: vi.fn(() => null),
}));

vi.mock("@/lib/ai/intent-classifier", () => ({
  classifyIntent: vi.fn(async (text: string) => {
    if (text.includes("抽签") || text.includes("抽灵签")) {
      return { intent: "divination", confidence: 1, source: "keyword" };
    }
    if (text.includes("解梦")) return { intent: "dream", confidence: 1, source: "keyword" };
    if (text.includes("八字")) return { intent: "bazi", confidence: 1, source: "keyword" };
    if (text.includes("测算")) return { intent: "meihua", confidence: 1, source: "keyword" };
    return { intent: "chat", confidence: 0.5, source: "fallback" };
  }),
}));

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async () => ({
    textStream: (async function* () {
      yield "好的";
    })(),
    usage: Promise.resolve({ totalTokens: 5 }),
  })),
}));

vi.mock("@/lib/ai/summarizer", () => ({
  K_RECENT: 6,
  buildPromptMessages: vi.fn(() => [
    { role: "system", content: "S" },
    { role: "user", content: "u" },
  ]),
  shouldSummarize: vi.fn(() => false),
  summarize: vi.fn(async () => "skipped"),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

interface FakeConv {
  id: string;
  user_id: string;
  summary: string | null;
  summary_msg_count: number;
}

function makeFakeDb(opts: {
  ownedConv?: FakeConv | null;
  insertReturnIds?: string[];
} = {}) {
  let insertCounter = 0;
  const ownedConv = opts.ownedConv ?? { id: "conv-1", user_id: "user-1", summary: null, summary_msg_count: 0 };
  const insertReturnIds = opts.insertReturnIds ?? ["m-1", "m-2", "m-3"];

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(ownedConv ? [ownedConv] : []),
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          const id = insertReturnIds[insertCounter++] ?? `m-${insertCounter}`;
          return Promise.resolve([{ id, content: "x", metadata: null, created_at: "2026-04-26T00:00:00Z" }]);
        },
        run: () => Promise.resolve(),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve() }),
    }),
  };
}

describe("POST /api/chat schema", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("conversationId:null 不报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: null, text: "你好" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("空 text 报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("超长 text > 2000 报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(2001) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("非法 JSON 报 400", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
