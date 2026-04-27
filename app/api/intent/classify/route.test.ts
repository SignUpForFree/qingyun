import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/client", () => ({
  chat: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const text = messages[messages.length - 1].content;
    if (/命理|大运/.test(text)) return { text: "bazi", tokensUsed: 5 };
    return { text: "chat", tokensUsed: 5 };
  }),
}));

import { POST } from "./route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/intent/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/intent/classify (M2.27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("关键词命中 → keyword 分类，confidence=1", async () => {
    const r = await POST(makeReq({ text: "我想抽签" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { intent: string; confidence: number; source: string };
    expect(j.intent).toBe("divination");
    expect(j.source).toBe("keyword");
    expect(j.confidence).toBe(1);
  });

  it("关键词 miss → LLM 兜底分类，source=llm", async () => {
    const r = await POST(makeReq({ text: "想了解一下命理" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { intent: string; source: string };
    expect(j.intent).toBe("bazi");
    expect(j.source).toBe("llm");
  });

  it("纯闲聊 → chat / source=llm", async () => {
    const r = await POST(makeReq({ text: "今天天气还不错呀" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { intent: string };
    expect(j.intent).toBe("chat");
  });

  it("空 text → 400 invalid_input", async () => {
    const r = await POST(makeReq({ text: "" }));
    expect(r.status).toBe(400);
  });

  it("缺 text 字段 → 400 invalid_input", async () => {
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
  });

  it("text 超长 (>500) → 400 invalid_input", async () => {
    const r = await POST(makeReq({ text: "a".repeat(501) }));
    expect(r.status).toBe(400);
  });

  it("非法 JSON body → 400 invalid_json", async () => {
    const req = new Request("http://localhost/api/intent/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe("invalid_json");
  });

  it("响应 schema：含 intent + confidence + source", async () => {
    const r = await POST(makeReq({ text: "起一卦" }));
    const j = (await r.json()) as Record<string, unknown>;
    expect(typeof j.intent).toBe("string");
    expect(typeof j.confidence).toBe("number");
    expect(typeof j.source).toBe("string");
  });
});
