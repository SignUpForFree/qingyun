import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("POST /api/divination/dream", () => {
  it("mode=fast 必须含 dreamText", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: "c1", mode: "fast", payload: {} }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it("mode=precise 必须含 core + emotion", async () => {
    const r = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "c1",
          mode: "precise",
          payload: { core: "梦到山" },
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
        body: JSON.stringify({
          conversationId: "c1",
          mode: "weird",
          payload: {},
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
        body: "broken",
      }),
    );
    expect(r.status).toBe(400);
  });
});
