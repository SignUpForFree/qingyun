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
  chat: vi.fn(async () => ({
    textStream: (async function* () {
      yield "[心理视角] 焦虑；";
      yield "[周公解梦] 一夜安寝；";
      yield "[现代实用建议] 多休息。";
    })(),
    usage: Promise.resolve({ totalTokens: 80 }),
  })),
}));

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

  it("mode=precise → SSE 流 + dream_result_precise + threeViews", async () => {
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

  it("AI timeout → SSE error event ai_timeout retryable", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error("timeout exceeded"),
    );
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "fast", dream: "x" }),
      }),
    );
    expect(r.status).toBe(200);
    const text = await readSse(r);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_timeout");
  });
});
