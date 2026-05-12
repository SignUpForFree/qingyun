import { test, expect } from "@playwright/test";

/**
 * 反馈 API 烟测
 *
 * 校验：
 *   - 缺 confirm/category 字段：返回 400 validation
 *   - 正常提交：200 ok
 *   - 6 次连发同 user：第 6 次起返回 429 rate_limited（24h 限 5 条）
 */
test.describe("/api/feedback", () => {
  test("validation + happy + rate limit", async ({ request }) => {
    const loginRes = await request.post("/api/dev-login", { data: {} });
    expect(loginRes.ok()).toBeTruthy();

    // validation：空 content
    const bad = await request.post("/api/feedback", {
      data: { category: "建议", content: "" },
    });
    expect(bad.status()).toBe(400);

    // 5 次 ok
    for (let i = 0; i < 5; i++) {
      const r = await request.post("/api/feedback", {
        data: {
          category: "建议",
          content: `第 ${i + 1} 条反馈测试 — 这是一段长一点的内容用来通过校验`,
        },
      });
      expect(r.ok(), `第 ${i + 1} 条应当成功，但 ${r.status()}`).toBeTruthy();
    }

    // 第 6 次应当 429
    const sixth = await request.post("/api/feedback", {
      data: { category: "建议", content: "第 6 条应当被限流" },
    });
    expect(sixth.status()).toBe(429);
    const data = await sixth.json();
    expect(data.error).toBe("rate_limited");
  });
});
