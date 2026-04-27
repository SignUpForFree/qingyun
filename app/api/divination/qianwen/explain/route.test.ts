import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  ensureUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/ai/check-rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, used: 0, limit: 30 })),
}));

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async () => ({
    textStream: (async function* () {
      yield "解读";
      yield "片段";
    })(),
    usage: Promise.resolve({ totalTokens: 100 }),
  })),
}));

const SLIP_IMAGE_META = {
  ui: "slip_image",
  slipNumber: 7,
  level: "上吉",
  title: "渔翁得利",
  poemLines: ["平生学道未尝闲", "鼓吹欢呼柳影间", "今日相逢欢自喜", "明朝富贵亦悠然"],
  category: "事业学业",
  reading: "工作有贵人扶持",
  imageUrl: "/api/divination/slip-image/7",
};

function makeFakeDb(opts: {
  sourceMsg?: {
    id: string;
    conversation_id: string;
    metadata: string | null;
    content: string;
  } | null;
  existingReports?: Array<{
    id: string;
    content: string;
    metadata: string;
  }>;
} = {}) {
  const sourceMsg =
    opts.sourceMsg === undefined
      ? {
          id: "msg-source",
          conversation_id: "conv-1",
          metadata: JSON.stringify(SLIP_IMAGE_META),
          content: "签",
        }
      : opts.sourceMsg;
  const existingReports = opts.existingReports ?? [];
  let selectCounter = 0;

  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(sourceMsg ? [sourceMsg] : []),
          }),
        }),
        where: () => Promise.resolve(existingReports),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([{ id: "card-new", content: "", metadata: null, created_at: "t" }]),
      }),
    }),
  };
}

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

import { POST } from "./route";

async function readSse(res: Response): Promise<string> {
  return await res.text();
}

describe("POST /api/divination/qianwen/explain — happy path", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("成功 200 + SSE token + card slip_report + done", async () => {
    const req = new Request("http://test/api/divination/qianwen/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-source" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await readSse(res);
    expect(text).toContain("event: meta");
    expect(text).toContain("event: token");
    expect(text).toContain("event: card");
    expect(text).toContain("event: done");
    expect(text).toContain("slip_report");
    expect(text).toContain('"sourceMessageId":"msg-source"');
  });
});

describe("POST /api/divination/qianwen/explain — idempotent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("同 messageId 已生成 slip_report → 直接返 JSON 不流式", async () => {
    const existing = {
      id: "report-1",
      content: "之前生成的解读",
      metadata: JSON.stringify({
        ui: "slip_report",
        sourceMessageId: "msg-source",
        slipNumber: 7,
        level: "上吉",
        title: "渔翁得利",
        poem: "诗",
        dimension: "事业学业",
        reading: "x",
        aiInterpretation: "之前生成的解读",
      }),
    };

    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ existingReports: [existing] }),
    );

    const req = new Request("http://test/api/divination/qianwen/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-source" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const j = (await res.json()) as { idempotent: boolean; card: { content: string } };
    expect(j.idempotent).toBe(true);
    expect(j.card.content).toBe("之前生成的解读");
  });
});

describe("POST /api/divination/qianwen/explain — error paths", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(makeFakeDb());
  });

  it("缺 messageId → 400", async () => {
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("非法 JSON → 400", async () => {
    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rate limit → 429", async () => {
    const { checkRateLimit } = await import("@/lib/ai/check-rate-limit");
    (checkRateLimit as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      allowed: false,
      used: 30,
      limit: 30,
    });

    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("源消息不存在 / 跨用户 → 404", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({ sourceMsg: null }),
    );

    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-not-mine" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("源消息 metadata 不是 slip_image → 400", async () => {
    const { getDb } = await import("@/lib/db/client");
    (getDb as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      makeFakeDb({
        sourceMsg: {
          id: "msg-bad",
          conversation_id: "conv-1",
          metadata: JSON.stringify({ ui: "text" }),
          content: "x",
        },
      }),
    );

    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-bad" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("AI timeout → SSE error event with code=ai_timeout retryable=true", async () => {
    const { chat } = await import("@/lib/ai/client");
    (chat as unknown as { mockRejectedValueOnce: (e: Error) => void }).mockRejectedValueOnce(
      new Error("AbortError: timeout exceeded"),
    );

    const req = new Request("http://test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: "msg-source" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const text = await readSse(res);
    expect(text).toContain("event: error");
    expect(text).toContain("ai_timeout");
    expect(text).toContain('"retryable":true');
  });
});
