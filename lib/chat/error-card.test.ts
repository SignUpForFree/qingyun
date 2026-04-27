import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildErrorCard,
  errorCardResponse,
  isTimeoutError,
} from "./error-card";

describe("buildErrorCard (M2.28)", () => {
  it("ai_timeout retryable=true", () => {
    const c = buildErrorCard("ai_timeout");
    expect(c.ui).toBe("error_card");
    expect(c.code).toBe("ai_timeout");
    expect(c.retryable).toBe(true);
    expect(c.message).toContain("AI");
  });

  it("user_rate_limit retryable=false", () => {
    const c = buildErrorCard("user_rate_limit");
    expect(c.retryable).toBe(false);
  });

  it("content_safety retryable=false", () => {
    const c = buildErrorCard("content_safety");
    expect(c.retryable).toBe(false);
  });

  it("自定义 message 覆盖默认", () => {
    const c = buildErrorCard("ai_timeout", "你的网络抖了一下");
    expect(c.message).toBe("你的网络抖了一下");
  });

  it("network / unknown retryable=true", () => {
    expect(buildErrorCard("network").retryable).toBe(true);
    expect(buildErrorCard("unknown").retryable).toBe(true);
  });
});

describe("errorCardResponse", () => {
  it("429 user_rate_limit JSON 含 error + errorCard", async () => {
    const r = errorCardResponse("user_rate_limit", 429);
    expect(r.status).toBe(429);
    const j = (await r.json()) as { error: string; errorCard: { ui: string; code: string } };
    expect(j.error).toContain("喘口气");
    expect(j.errorCard.ui).toBe("error_card");
    expect(j.errorCard.code).toBe("user_rate_limit");
  });

  it("400 content_safety", async () => {
    const r = errorCardResponse("content_safety", 400);
    expect(r.status).toBe(400);
    const j = (await r.json()) as { errorCard: { code: string; retryable: boolean } };
    expect(j.errorCard.code).toBe("content_safety");
    expect(j.errorCard.retryable).toBe(false);
  });

  it("自定义 message", async () => {
    const r = errorCardResponse("ai_timeout", 504, "卡死了");
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe("卡死了");
  });
});

describe("isTimeoutError", () => {
  it("Error('timeout exceeded') → true", () => {
    expect(isTimeoutError(new Error("timeout exceeded"))).toBe(true);
  });

  it("Error('AbortError') → true", () => {
    expect(isTimeoutError(new Error("aborted by user"))).toBe(true);
  });

  it("非 Error → false", () => {
    expect(isTimeoutError("timeout")).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });

  it("Error('rate limit') → false", () => {
    expect(isTimeoutError(new Error("rate limit"))).toBe(false);
  });
});
