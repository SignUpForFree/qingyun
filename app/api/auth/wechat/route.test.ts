import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
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

describe("GET /api/auth/wechat", () => {
  it("302 to wechat authorize url with state", async () => {
    const r = await GET(new Request("https://x.test/api/auth/wechat"));
    expect(r.status).toBe(302);
    const loc = r.headers.get("location")!;
    expect(loc).toMatch(/^https:\/\/open\.weixin\.qq\.com/);
    expect(loc).toContain("scope=snsapi_userinfo");
    expect(loc).toContain("state=");
  });

  it("each call generates a fresh nonce (state differs)", async () => {
    const a = await GET(new Request("https://x.test/api/auth/wechat"));
    await new Promise((r) => setTimeout(r, 5));
    const b = await GET(new Request("https://x.test/api/auth/wechat"));
    const stateA = new URL(a.headers.get("location")!.replace(/#.*$/, "")).searchParams.get("state")!;
    const stateB = new URL(b.headers.get("location")!.replace(/#.*$/, "")).searchParams.get("state")!;
    expect(stateA).not.toBe(stateB);
  });
});
