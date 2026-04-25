import { describe, it, expect, vi } from "vitest";
import { evaluateLimit, isWithinLimit, HOURLY_LIMIT } from "./rate-limit";

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
    expect(fn).toHaveBeenCalledWith("user-1", "2026-04-26T09:00:00.000Z");
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
