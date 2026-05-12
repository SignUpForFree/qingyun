import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendOtp, verifyOtp, __resetForTests } from "./phone-otp";

/**
 * phone-otp v2 (KVStore + SmsProvider)
 *
 * 5 路径覆盖：
 *   1. 6 位数字 code 生成 + mock provider 收到 [code, ttlMin] params
 *   2. 同 phone 60s rate limit
 *   3. 10 分钟有效窗口内验证通过
 *   4. 错误窗口外（>10min）返回 expired
 *   5. 连续 3 次错误后锁定
 *
 * 注意：v2 起 sendOtp 走 SmsProvider；测试用 MockSmsProvider 的 console.info
 *      `[sms:mock] phone=... template=... params=["xxxxxx","10"]` 抓 code。
 */

function lastSmsParams(): string[] {
  const calls = vi.mocked(console.info).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const log = String(calls[i][0]);
    const m = log.match(/params=(\[.*\])/);
    if (m) return JSON.parse(m[1]) as string[];
  }
  throw new Error("MockSmsProvider console.info not captured");
}

describe("phone-otp", () => {
  beforeEach(() => {
    __resetForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("generates 6-digit code on send", async () => {
    const result = await sendOtp("+8613800138000");
    expect(result.sent).toBe(true);
    expect(result.cooldownMs).toBeUndefined();

    const params = lastSmsParams();
    expect(params[0]).toMatch(/^\d{6}$/);

    expect(await verifyOtp("+8613800138000", params[0])).toEqual({ ok: true });
  });

  it("rate limits 1/60s per phone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    const first = await sendOtp("+8613800138000");
    expect(first.sent).toBe(true);

    vi.advanceTimersByTime(30_000);
    const second = await sendOtp("+8613800138000");
    expect(second.sent).toBe(false);
    expect(second.cooldownMs).toBeGreaterThan(0);
    // KV ttl 取整到秒，cooldownMs 上限可能略 >30000ms
    expect(second.cooldownMs).toBeLessThanOrEqual(31_000);

    vi.advanceTimersByTime(31_000);
    const third = await sendOtp("+8613800138000");
    expect(third.sent).toBe(true);

    const other = await sendOtp("+8613900139000");
    expect(other.sent).toBe(true);
  });

  it("verifies within 10 min window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    await sendOtp("+8613800138000");
    const code = lastSmsParams()[0];

    vi.advanceTimersByTime(9 * 60_000 + 59_000);
    expect(await verifyOtp("+8613800138000", code)).toEqual({ ok: true });
  });

  it("returns expired when code is older than 10 min", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));

    await sendOtp("+8613800138000");
    const code = lastSmsParams()[0];

    vi.advanceTimersByTime(10 * 60_000 + 1_000);
    const r = await verifyOtp("+8613800138000", code);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");

    const r2 = await verifyOtp("+8613800138000", code);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("expired");
  });

  it("rejects after 3 wrong attempts", async () => {
    await sendOtp("+8613800138000");
    const realCode = lastSmsParams()[0];

    expect(await verifyOtp("+8613800138000", "000000")).toEqual({
      ok: false,
      reason: "wrong",
    });
    expect(await verifyOtp("+8613800138000", "111111")).toEqual({
      ok: false,
      reason: "wrong",
    });
    expect(await verifyOtp("+8613800138000", "222222")).toEqual({
      ok: false,
      reason: "wrong",
    });

    expect(await verifyOtp("+8613800138000", realCode)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });

    expect(await verifyOtp("+8613800138000", realCode)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
