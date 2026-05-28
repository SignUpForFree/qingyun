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

describe("POST /api/chat — M2.15 SSE 路由", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  async function readSse(res: Response): Promise<string> {
    return await res.text();
  }

  it("成功 200 + SSE Content-Type", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "你好" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
  });

  it("intent=chat → 流式 token 事件 + meta + done", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "你好" }),
    });
    const text = await readSse(await POST(req));
    expect(text).toContain("event: meta");
    expect(text).toContain("event: token");
    expect(text).toContain("event: done");
    expect(text).toMatch(/"intent":"chat"/);
  });

  it("intent=divination → SSE card 事件含 slip_type_picker metadata", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "我想抽签" }),
    });
    const text = await readSse(await POST(req));
    expect(text).toContain("event: card");
    expect(text).toContain("slip_type_picker");
    expect(text).toContain('"intent":"divination"');
  });

  it("intent=dream → SSE card 直接含梦境输入引导", async () => {
    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "我想解梦" }),
    });
    const text = await readSse(await POST(req));
    expect(text).toContain("请描述你的梦境内容");
    expect(text).toContain("dreamAwaitingInput");
    expect(text).not.toContain("dream_choice");
  });

  it("?intent=meihua query 覆盖分类器（即使 text 是抽签关键词）", async () => {
    const req = new Request("http://test/api/chat?intent=meihua", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "我想抽签" }),
    });
    const text = await readSse(await POST(req));
    expect(text).toContain('"intent":"meihua"');
    expect(text).toContain('"source":"query"');
  });

  it("?intent=invalid 非法值不覆盖（fallback 走 classifier）", async () => {
    const req = new Request("http://test/api/chat?intent=banana", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "我想抽签" }),
    });
    const text = await readSse(await POST(req));
    // text 命中 "抽签" → divination via classifier
    expect(text).toContain('"intent":"divination"');
    expect(text).toContain('"source":"keyword"');
  });

  it("限流命中 → 429 不进 SSE", async () => {
    const { checkRateLimit } = await import("@/lib/ai/check-rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      allowed: false,
      used: 30,
      limit: 30,
    });

    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "你好" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("安全词 guard 拦截 → 不进 SSE", async () => {
    const { guardTexts } = await import("@/lib/safety/guard");
    (guardTexts as unknown as { mockReturnValueOnce: (v: unknown) => void }).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "blocked" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = new Request("http://test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "敏感词" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});
