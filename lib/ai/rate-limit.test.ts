import { describe, it, expect, vi } from "vitest";
import {
  evaluateLimit,
  isWithinLimit,
  HOURLY_LIMIT,
  INTENT_LIMITS,
  limitForIntent,
  rateConfigForIntent,
  windowMsForIntent,
} from "./rate-limit";

describe("evaluateLimit", () => {
  it("使用量 < 上限 → 允许", () => {
    const r = evaluateLimit(12, 30);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(18);
    expect(r.limit).toBe(30);
  });

  it("使用量 = 上限 → 拒绝", () => {
    const r = evaluateLimit(30, 30);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("使用量 > 上限 → 拒绝且 remaining 为 0", () => {
    const r = evaluateLimit(50, 30);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("使用量 0 → 允许且 remaining = limit", () => {
    const r = evaluateLimit(0, 30);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(30);
  });

  it("负使用量按 0 处理", () => {
    const r = evaluateLimit(-5, 30);
    expect(r.used).toBe(0);
    expect(r.allowed).toBe(true);
  });

  it("默认上限来自 HOURLY_LIMIT", () => {
    const r = evaluateLimit(1);
    expect(r.limit).toBe(HOURLY_LIMIT);
  });
});

describe("isWithinLimit (注入式)", () => {
  it("count < 30 → 允许且 since 是 1 小时前", async () => {
    const fn = vi.fn().mockResolvedValue(12);
    const now = new Date("2026-04-26T10:00:00.000Z");
    const r = await isWithinLimit("user-1", { countUserMessages: fn }, { now });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(18);
    expect(fn).toHaveBeenCalledWith("user-1", "2026-04-26T09:00:00.000Z", undefined);
  });

  it("count = 30 → 拒绝", async () => {
    const r = await isWithinLimit(
      "user-1",
      { countUserMessages: () => Promise.resolve(30) },
      { limit: 30 },
    );
    expect(r.allowed).toBe(false);
  });

  it("count 抛错时 fail-open（放行）", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await isWithinLimit("user-1", {
      countUserMessages: () => Promise.reject(new Error("supabase down")),
    });
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("自定义 limit 覆盖默认值", async () => {
    const r = await isWithinLimit(
      "user-1",
      { countUserMessages: () => Promise.resolve(8) },
      { limit: 10 },
    );
    expect(r.limit).toBe(10);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });
});

describe("limitForIntent (M3.30)", () => {
  it("intent 无 / 不识别 → HOURLY_LIMIT 默认值", () => {
    expect(limitForIntent()).toBe(HOURLY_LIMIT);
    expect(limitForIntent(null)).toBe(HOURLY_LIMIT);
    expect(limitForIntent("nope")).toBe(HOURLY_LIMIT);
  });

  it("各 intent 限额命中 INTENT_LIMITS", () => {
    expect(limitForIntent("chat")).toBe(30);
    expect(limitForIntent("bazi")).toBe(8);
    expect(limitForIntent("meihua")).toBe(8);
    expect(limitForIntent("dream")).toBe(8);
    if (process.env.NODE_ENV === "production") {
      expect(limitForIntent("divination")).toBe(12);
      expect(windowMsForIntent("divination")).toBe(60 * 60 * 1000);
    } else {
      expect(limitForIntent("divination")).toBe(999_999);
      expect(windowMsForIntent("divination")).toBe(60 * 1000);
    }
  });

  it("divination 统计窗口为 1 分钟（非生产）", async () => {
    if (process.env.NODE_ENV === "production") return;
    const fn = vi.fn().mockResolvedValue(0);
    const now = new Date("2026-04-26T10:00:00.000Z");
    await isWithinLimit("user-1", { countUserMessages: fn }, { now, intent: "divination" });
    expect(fn).toHaveBeenCalledWith("user-1", "2026-04-26T09:59:00.000Z", "divination");
    expect(rateConfigForIntent("divination").limit).toBe(999_999);
  });

  it("INTENT_LIMITS bazi/meihua/dream 比 chat 严", () => {
    expect(INTENT_LIMITS.bazi).toBeLessThan(INTENT_LIMITS.chat);
    expect(INTENT_LIMITS.meihua).toBeLessThan(INTENT_LIMITS.chat);
    expect(INTENT_LIMITS.dream).toBeLessThan(INTENT_LIMITS.chat);
  });
});

describe("isWithinLimit + intent (M3.30)", () => {
  it("intent='bazi' 时 limit 为 8 而非 30", async () => {
    const fn = vi.fn().mockResolvedValue(5);
    const r = await isWithinLimit(
      "user-1",
      { countUserMessages: fn },
      { intent: "bazi" },
    );
    expect(r.limit).toBe(8);
    expect(r.intent).toBe("bazi");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it("intent 透传给 countUserMessages 第三参", async () => {
    const fn = vi.fn().mockResolvedValue(0);
    const now = new Date("2026-04-26T10:00:00.000Z");
    await isWithinLimit(
      "user-2",
      { countUserMessages: fn },
      { now, intent: "meihua" },
    );
    expect(fn).toHaveBeenCalledWith("user-2", "2026-04-26T09:00:00.000Z", "meihua");
  });

  it("intent='bazi' 已用 8 次 → 拒绝", async () => {
    const r = await isWithinLimit(
      "user-1",
      { countUserMessages: () => Promise.resolve(8) },
      { intent: "bazi" },
    );
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
});
