import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { evaluateLimit } from "./rate-limit";

/**
 * checkRateLimit 是 drizzle 包装版（走 DB），需要真实数据库。
 * 这里只测它委托的纯函数 evaluateLimit 行为，drizzle 部分通过
 * route 集成 / e2e 烟测覆盖。
 */
describe("evaluateLimit（rate-limit 内核）", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_PER_USER_HOURLY = "30";
  });

  it("用量小于上限 → allowed", () => {
    const r = evaluateLimit(5, 30);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(25);
  });

  it("用量等于上限 → 拒绝", () => {
    expect(evaluateLimit(30, 30).allowed).toBe(false);
  });

  it("用量超过上限 → 拒绝且 remaining=0", () => {
    const r = evaluateLimit(99, 30);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("负数 / 浮点用量被规整", () => {
    expect(evaluateLimit(-3, 30).used).toBe(0);
    expect(evaluateLimit(2.7, 30).used).toBe(2);
  });
});
