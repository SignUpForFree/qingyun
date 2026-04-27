import { describe, it, expect, beforeEach } from "vitest";
import { envSchema, getEnv, resetEnvCache } from "./env";

const COMPLETE_ENV = {
  DATABASE_URL: "file:./data/qingyun.db",
  AI_GATEWAY_BASE_URL: "https://api.ofox.ai/v1",
  AI_GATEWAY_API_KEY: "ofx-x",
  AI_GATEWAY_MODEL: "deepseek/deepseek-v4-pro",
  WECHAT_APPID: "wx123",
  WECHAT_APPSECRET: "secret",
  WECHAT_STATE_SECRET: "x".repeat(44),
  WECHAT_AES_KEY: "x".repeat(44),
  WECHAT_TPL_DAILY_FORTUNE: "tpl1",
  WECHAT_TPL_REPORT_READY: "tpl2",
  WECHAT_OA_REDIRECT_URI: "https://qingyun.example.com/api/auth/wechat/callback",
  PUBLIC_BASE_URL: "https://qingyun.example.com",
  SESSION_SECRET: "x".repeat(86),
};

describe("envSchema", () => {
  beforeEach(() => resetEnvCache());

  it("rejects empty input", () => {
    const r = envSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toMatch(/WECHAT_APPID/);
  });

  it("rejects WECHAT_STATE_SECRET shorter than 40 chars", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, WECHAT_STATE_SECRET: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects WECHAT_AES_KEY shorter than 40 chars", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, WECHAT_AES_KEY: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects SESSION_SECRET shorter than 64 chars", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, SESSION_SECRET: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects COOKIE_SAMESITE=none (防御 #12)", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, COOKIE_SAMESITE: "none" });
    expect(r.success).toBe(false);
  });

  it("rejects AI_TIMEOUT_MS below 60000 (防御 #2)", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, AI_TIMEOUT_MS: "30000" });
    expect(r.success).toBe(false);
  });

  it("accepts a complete env", () => {
    const r = envSchema.safeParse(COMPLETE_ENV);
    expect(r.success).toBe(true);
  });

  it("defaults rate limit and cron expressions", () => {
    const r = envSchema.safeParse(COMPLETE_ENV);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.RATE_LIMIT_PER_HOUR_CHAT).toBe(30);
      expect(r.data.RATE_LIMIT_PER_HOUR_BAZI).toBe(5);
      expect(r.data.CRON_DAILY_FORTUNE).toBe("30 0 * * *");
      expect(r.data.CRON_TZ).toBe("Asia/Shanghai");
      expect(r.data.AI_TIMEOUT_MS).toBe(60000);
      expect(r.data.COOKIE_SAMESITE).toBe("lax");
    }
  });

  it("accepts AI_TIMEOUT_MS exactly 60000", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, AI_TIMEOUT_MS: "60000" });
    expect(r.success).toBe(true);
  });

  it("optional SENTRY_DSN: missing OK", () => {
    const r = envSchema.safeParse(COMPLETE_ENV);
    expect(r.success).toBe(true);
  });

  it("validates SENTRY_DSN as url when present", () => {
    const r = envSchema.safeParse({ ...COMPLETE_ENV, SENTRY_DSN: "not-a-url" });
    expect(r.success).toBe(false);
  });
});

describe("getEnv", () => {
  beforeEach(() => resetEnvCache());

  it("throws with helpful issues list when input incomplete", () => {
    expect(() => getEnv({} as unknown as NodeJS.ProcessEnv)).toThrow(/ENV schema fail/);
  });

  it("returns parsed env when complete", () => {
    const env = getEnv(COMPLETE_ENV as unknown as NodeJS.ProcessEnv);
    expect(env.WECHAT_APPID).toBe("wx123");
    expect(env.AI_TIMEOUT_MS).toBe(60000);
  });

  it("caches result across calls", () => {
    const a = getEnv(COMPLETE_ENV as unknown as NodeJS.ProcessEnv);
    const b = getEnv({} as unknown as NodeJS.ProcessEnv); // 缓存命中后忽略输入
    expect(b).toBe(a);
  });

  it("resetEnvCache forces re-parse", () => {
    getEnv(COMPLETE_ENV as unknown as NodeJS.ProcessEnv);
    resetEnvCache();
    expect(() => getEnv({} as unknown as NodeJS.ProcessEnv)).toThrow(/ENV schema fail/);
  });
});
