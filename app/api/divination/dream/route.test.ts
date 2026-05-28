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

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async (input: { stream?: boolean }) => {
    const body =
      "**梦境核心解析**\n梦见河流与鱼。\n\n**潜意识情绪解读**\n内心期待。\n\n**温柔建议与疗愈引导**\n- 休息\n*仅为趣味与心理参考。*";
    if (input.stream) {
      return {
        textStream: (async function* () {
          yield body;
        })(),
        text: Promise.resolve(body),
        fullStream: (async function* () {
          yield { type: "text-delta", text: body };
        })(),
        usage: Promise.resolve({ totalTokens: 80 }),
        finishReason: Promise.resolve("stop"),
      };
    }
    return { text: body, tokensUsed: 80 };
  }),
}));

/** requireAiGateway() 在路由入口校验；测试里给假 key 避免 503 */
beforeEach(() => {
  process.env.AI_GATEWAY_API_KEY = "test-key-for-vitest";
});

function makeFakeDb(opts: { ownedConv?: boolean } = {}) {
  const ownedConv = opts.ownedConv ?? true;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(ownedConv ? [{ id: "conv-1" }] : []),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([{ id: "card-1", content: "", metadata: null, created_at: "t" }]),
        run: () => Promise.resolve(),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

async function readSse(res: Response): Promise<string> {
  return await res.text();
}

describe("POST /api/divination/dream — schema validation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("mode=fast 缺 dream → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "fast" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("mode=precise 缺 core → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "precise",
          emotion: "紧张",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("mode=precise 缺 emotion → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "precise",
          core: "考试",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("mode 必须是 fast / precise", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "weird" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("非法 JSON → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "broken",
      }),
    );
    expect(r.status).toBe(400);
  });

  it("缺 conversationId → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "fast", dream: "x" }),
      }),
    );
    expect(r.status).toBe(400);
  });
});

describe("POST /api/divination/dream — happy path", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("mode=fast → SSE 流 + dream_result_fast 卡", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "fast",
          dream: "梦到山顶",
        }),
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await readSse(r);
    expect(text).toContain("event: meta");
    expect(text).toContain("event: token");
    expect(text).toContain("event: card");
    expect(text).toContain("event: done");
    expect(text).toContain("dream_result_fast");
    expect(text).toContain('"mode":"fast"');
  });

  it("mode=precise → SSE 流 + dream_result_precise + structured sections", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "precise",
          core: "梦见考试",
          emotion: "紧张",
          reality: "下周面试",
          special: "数字 7",
        }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("dream_result_precise");
    expect(text).toContain("threeViews");
    expect(text).toContain("empathy");
    expect(text).toContain("coreMeaning");
    expect(text).toContain("subconsciousMsg");
    expect(text).toContain("conclusion");
    expect(text).toContain('"mode":"precise"');
  });

  it("mode=precise reality / special 选填 → 通过", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "precise",
          core: "梦见水",
          emotion: "平静",
        }),
      }),
    );
    expect(r.status).toBe(200);
  });
});

describe("POST /api/divination/dream — error paths", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("rate limit → 429", async () => {
    const { checkRateLimit } = await import("@/lib/ai/check-rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      allowed: false,
      used: 30,
      limit: 30,
    });
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "fast", dream: "x" }),
      }),
    );
    expect(r.status).toBe(429);
  });

  it("会话不存在 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ ownedConv: false }),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "wrong", mode: "fast", dream: "x" }),
      }),
    );
    expect(r.status).toBe(404);
  });

  it("流式为空但 non-stream 重试成功 → 仍有 dream_result_fast", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (input: { stream?: boolean }) => {
        if (input.stream) {
          return {
            textStream: (async function* () {})(),
            text: Promise.resolve(""),
            fullStream: (async function* () {})(),
            usage: Promise.resolve({ totalTokens: 0 }),
            finishReason: Promise.resolve("stop"),
          };
        }
        return { text: "重试成功的解梦正文，梦见河流与鱼。", tokensUsed: 42 };
      },
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "fast",
          dream: "做梦了",
        }),
      }),
    );
    const text = await readSse(r);
    expect(text).toContain("dream_result_fast");
    expect(text).toContain("重试成功的解梦正文");
    expect(text).not.toContain("event: error");
  });

  it("流式与非流式均为空 → SSE error ai_empty，不写结果卡", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (input: { stream?: boolean }) => {
        if (input.stream) {
          return {
            textStream: (async function* () {})(),
            text: Promise.resolve(""),
            fullStream: (async function* () {})(),
            usage: Promise.resolve({ totalTokens: 0 }),
            finishReason: Promise.resolve("stop"),
          };
        }
        return { text: "", tokensUsed: 0 };
      },
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "fast",
          dream: "做梦了",
        }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_empty");
    expect(text).not.toContain("dream_result_fast");
    expect(text).not.toContain("AI 解梦未生成");
  });

  it("AI 网关未配置 → 503", async () => {
    const prev = process.env.AI_GATEWAY_API_KEY;
    const prevDs = process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "fast",
          dream: "做梦了",
        }),
      }),
    );
    if (prev) process.env.AI_GATEWAY_API_KEY = prev;
    if (prevDs) process.env.DEEPSEEK_API_KEY = prevDs;
    expect(r.status).toBe(503);
  });

  it("AI timeout → SSE error event ai_timeout retryable", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error("timeout exceeded"),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "fast", dream: "做梦了" }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_timeout");
  });
});
