import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendOtp, verifyOtp, __resetForTests } from "./phone-otp";

/**
 * M1.10 phone OTP — pure unit tests (no DB, no HTTP)
 *
 * 5 路径覆盖：
 *   1. 6 位数字 code 生成 + 写入
 *   2. 同 phone 60s rate limit
 *   3. 10 分钟有效窗口内验证通过
 *   4. 错误窗口外（>10min）返回 expired
 *   5. 连续 3 次错误后锁定
 */

describe("phone-otp", () => {
  beforeEach(() => {
    __resetForTests();
    // 静音 console.info（生产 OTP 在 M1 仅打日志，测试无需噪声）
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("generates 6-digit code on send", () => {
    const result = sendOtp("+8613800138000");
    expect(result.sent).toBe(true);
    expect(result.cooldownMs).toBeUndefined();

    // 通过 console.info 抓取 code（唯一暴露 code 的地方）
    const calls = vi.mocked(console.info).mock.calls;
    expect(calls.length).toBe(1);
    const logged = String(calls[0][0]);
    const match = logged.match(/\b(\d{6})\b/);
    expect(match).not.toBeNull();
    const code = match![1];
    expect(code).toMatch(/^\d{6}$/);

    // 该 code 必须能验证通过（证明它真的写进了 store）
    expect(verifyOtp("+8613800138000", code)).toEqual({ ok: true });
  });

  it("rate limits 1/60s per phone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    const first = sendOtp("+8613800138000");
    expect(first.sent).toBe(true);

    // 30s 后再发：应被限流
    vi.advanceTimersByTime(30_000);
    const second = sendOtp("+8613800138000");
    expect(second.sent).toBe(false);
    expect(second.cooldownMs).toBeGreaterThan(0);
    expect(second.cooldownMs).toBeLessThanOrEqual(30_000);

    // 60s 边界后：应再次允许
    vi.advanceTimersByTime(31_000); // 累计 61s
    const third = sendOtp("+8613800138000");
    expect(third.sent).toBe(true);

    // 不同手机号不互相影响
    const other = sendOtp("+8613900139000");
    expect(other.sent).toBe(true);
  });

  it("verifies within 10 min window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    sendOtp("+8613800138000");
    const code = String(vi.mocked(console.info).mock.calls[0][0]).match(
      /\b(\d{6})\b/,
    )![1];

    // 9 分 59 秒后仍可验证
    vi.advanceTimersByTime(9 * 60_000 + 59_000);
    expect(verifyOtp("+8613800138000", code)).toEqual({ ok: true });
  });

  it("returns expired when code is older than 10 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    sendOtp("+8613800138000");
    const code = String(vi.mocked(console.info).mock.calls[0][0]).match(
      /\b(\d{6})\b/,
    )![1];

    // 10 分 1 秒后超时
    vi.advanceTimersByTime(10 * 60_000 + 1_000);
    const r = verifyOtp("+8613800138000", code);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");

    // 过期条目应被删除：再 verify 仍是 expired（不是 wrong，避免泄露 phone 已存在）
    const r2 = verifyOtp("+8613800138000", code);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("expired");
  });

  it("rejects after 3 wrong attempts", () => {
    sendOtp("+8613800138000");
    const realCode = String(vi.mocked(console.info).mock.calls[0][0]).match(
      /\b(\d{6})\b/,
    )![1];

    // 3 次错误尝试都返回 wrong
    expect(verifyOtp("+8613800138000", "000000")).toEqual({
      ok: false,
      reason: "wrong",
    });
    expect(verifyOtp("+8613800138000", "111111")).toEqual({
      ok: false,
      reason: "wrong",
    });
    expect(verifyOtp("+8613800138000", "222222")).toEqual({
      ok: false,
      reason: "wrong",
    });

    // 第 4 次（即使是正确的 code）也应被锁定
    expect(verifyOtp("+8613800138000", realCode)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });

    // 锁定后条目已删除：再 verify 返回 expired
    expect(verifyOtp("+8613800138000", realCode)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
