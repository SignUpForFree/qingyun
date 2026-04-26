import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("POST /api/divination/meihua", () => {
  it("numbers 必须 1-3 个 1-9 整数（10 拒绝）", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          numbers: [10],
          userQuestion: "?",
        }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("numbers 最多 3 个", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          numbers: [1, 2, 3, 4],
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
          numbers: [1, 2, 3],
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
        body: "x",
      }),
    );
    expect(r.status).toBe(400);
  });
});
