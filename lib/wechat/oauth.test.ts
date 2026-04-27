import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signState, verifyState, buildAuthorizeUrl } from "./oauth";
import { resetEnvCache } from "@/lib/env";

const ENV_BASELINE = {
  DATABASE_URL: "file:./dev.db",
  AI_GATEWAY_BASE_URL: "https://api.ofox.ai/v1",
  AI_GATEWAY_API_KEY: "ofx-x",
  AI_GATEWAY_MODEL: "deepseek/deepseek-v4-pro",
  WECHAT_APPID: "wx-test-appid",
  WECHAT_APPSECRET: "secret-x",
  WECHAT_STATE_SECRET: "x".repeat(44),
  WECHAT_AES_KEY: "x".repeat(44),
  WECHAT_TPL_DAILY_FORTUNE: "tpl1",
  WECHAT_TPL_REPORT_READY: "tpl2",
  WECHAT_OA_REDIRECT_URI: "https://qingyun.example.com/api/auth/wechat/callback",
  PUBLIC_BASE_URL: "https://qingyun.example.com",
  SESSION_SECRET: "x".repeat(86),
};

beforeEach(() => {
  resetEnvCache();
  for (const [k, v] of Object.entries(ENV_BASELINE)) process.env[k] = v;
});

afterEach(() => {
  for (const k of Object.keys(ENV_BASELINE)) delete process.env[k];
  resetEnvCache();
});

describe("oauth state", () => {
  it("sign + verify roundtrip", () => {
    const s = signState("nonce-1");
    const v = verifyState(s);
    expect(v.ok).toBe(true);
    expect(v.nonce).toBe("nonce-1");
  });

  it("rejects state older than 5 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const s = signState("n2");
    vi.setSystemTime(new Date(2026, 0, 1, 0, 6));  // +6 min
    expect(verifyState(s).ok).toBe(false);
    vi.useRealTimers();
  });

  it("accepts state at edge of 5 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const s = signState("n3");
    vi.setSystemTime(new Date(2026, 0, 1, 0, 4, 59));  // 4:59 min later
    expect(verifyState(s).ok).toBe(true);
    vi.useRealTimers();
  });

  it("rejects tampered signature", () => {
    const s = signState("n4");
    const tampered = s.slice(0, -1) + (s.endsWith("a") ? "b" : "a");
    expect(verifyState(tampered).ok).toBe(false);
  });

  it("rejects malformed state (wrong number of parts)", () => {
    expect(verifyState("only.two").ok).toBe(false);
    expect(verifyState("a.b.c.d").ok).toBe(false);
    expect(verifyState("").ok).toBe(false);
  });

  it("rejects state with non-hex sig (timing-safe equal needs hex bytes)", () => {
    const s = signState("n5");
    const parts = s.split(".");
    // 用合法长度但非 hex 的字符替换签名
    const bad = `${parts[0]}.${parts[1]}.${"z".repeat(parts[2].length)}`;
    expect(verifyState(bad).ok).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  it("contains required oauth2 params", () => {
    const u = new URL(buildAuthorizeUrl("nonce-x"));
    expect(u.host).toBe("open.weixin.qq.com");
    expect(u.pathname).toBe("/connect/oauth2/authorize");
    expect(u.searchParams.get("appid")).toBe("wx-test-appid");
    expect(u.searchParams.get("redirect_uri")).toBe("https://qingyun.example.com/api/auth/wechat/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("snsapi_userinfo");
    const state = u.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(state!.split(".").length).toBe(3);
  });

  it("ends with #wechat_redirect fragment", () => {
    const url = buildAuthorizeUrl("nonce-y");
    expect(url.endsWith("#wechat_redirect")).toBe(true);
  });

  it("each call produces fresh signed state (timestamp differs)", async () => {
    const a = buildAuthorizeUrl("same-nonce");
    await new Promise(r => setTimeout(r, 5));
    const b = buildAuthorizeUrl("same-nonce");
    const stateA = new URL(a.replace(/#.*$/, "")).searchParams.get("state")!;
    const stateB = new URL(b.replace(/#.*$/, "")).searchParams.get("state")!;
    // timestamp differs → signature differs → states differ
    expect(stateA).not.toBe(stateB);
  });
});
