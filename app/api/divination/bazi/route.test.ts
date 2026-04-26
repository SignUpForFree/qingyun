import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("POST /api/divination/bazi", () => {
  it("focus 必须是新 6 类之一（旧 \"事业\" 拒绝）", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          focus: "事业",
          userQuestion: "?",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("conversationId 缺失 → 400", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          focus: "综合运势",
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
        body: "no",
      }),
    );
    expect(r.status).toBe(400);
  });
});
