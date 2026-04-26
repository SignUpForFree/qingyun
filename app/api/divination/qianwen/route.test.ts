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

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: "m", content: "x", metadata: null, created_at: "t" }]),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  })),
}));

import { POST } from "./route";

describe("POST /api/divination/qianwen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("body 必须含 conversationId（卡片提交模式）", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dimension: "事业学业", userQuestion: "项目能成吗" }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("dimension 必须是新 6 类之一（旧 \"事业\" 拒绝）", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "abc",
          dimension: "事业",
          userQuestion: "?",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("非法 JSON 报 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(r.status).toBe(400);
  });
});
