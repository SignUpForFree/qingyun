import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// Must mock ./client BEFORE importing token-store (token-store imports wechatFetch
// at module top-level). The factory returns a vi.fn so each test can stub via
// vi.mocked(wechatFetch).mockResolvedValueOnce(...).
vi.mock("./client", () => ({
  wechatFetch: vi.fn(),
}));

import { getDb } from "@/lib/db/client";
import { wechatToken } from "@/lib/db/schema";
import { resetEnvCache } from "@/lib/env";
import { wechatFetch } from "./client";
import { __resetMemCacheForTests, getToken } from "./token-store";

/**
 * token-store 双层缓存测试（spec §3.4 / CLAUDE.md 防御 #15）
 *
 *   mem (process-local) → SQLite singleton row → wechat cgi-bin refresh
 *
 * 5 个场景对应 plan §M1.5 Step 1 的 5 个 acceptance criteria。
 */

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

beforeEach(async () => {
  resetEnvCache();
  for (const [k, v] of Object.entries(ENV_BASELINE)) process.env[k] = v;

  __resetMemCacheForTests();
  const db = getDb();
  await db.delete(wechatToken);
  vi.mocked(wechatFetch).mockReset();
});

afterEach(() => {
  for (const k of Object.keys(ENV_BASELINE)) delete process.env[k];
  resetEnvCache();
});

describe("getToken — mem cache hit", () => {
  it("returns mem-cached value without re-invoking wechatFetch", async () => {
    vi.mocked(wechatFetch).mockResolvedValueOnce({
      access_token: "AT-1",
      expires_in: 7200,
    });

    const first = await getToken("access_token");
    expect(first).toBe("AT-1");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(1);

    // Second call should hit mem cache only — no extra fetch.
    const second = await getToken("access_token");
    expect(second).toBe("AT-1");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(1);
  });
});

describe("getToken — SQLite fallback", () => {
  it("returns DB-row value when mem cache empty but SQLite row valid", async () => {
    const db = getDb();
    const futureExpiry = Date.now() + 7200 * 1000;
    db.$client
      .prepare("INSERT INTO wechat_token (type, value, expires_at) VALUES (?, ?, ?)")
      .run("access_token", "AT-FROM-DB", futureExpiry);

    const v = await getToken("access_token");
    expect(v).toBe("AT-FROM-DB");
    expect(vi.mocked(wechatFetch)).not.toHaveBeenCalled();
  });
});

describe("getToken — refresh on full miss", () => {
  it("calls wechatFetch when both mem and SQLite are expired/missing", async () => {
    const db = getDb();
    db.$client
      .prepare("INSERT INTO wechat_token (type, value, expires_at) VALUES (?, ?, ?)")
      .run("access_token", "AT-OLD", Date.now() - 10_000); // already expired

    vi.mocked(wechatFetch).mockResolvedValueOnce({
      access_token: "AT-NEW",
      expires_in: 7200,
    });

    const v = await getToken("access_token");
    expect(v).toBe("AT-NEW");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(1);
  });
});

describe("getToken — SQLite singleton write-through", () => {
  it("upserts to wechat_token table after refresh; second call hits SQLite (not refetch)", async () => {
    vi.mocked(wechatFetch).mockResolvedValueOnce({
      access_token: "AT-WRITTEN",
      expires_in: 7200,
    });

    const first = await getToken("access_token");
    expect(first).toBe("AT-WRITTEN");

    // Verify SQLite row was written (singleton, type as PK)
    const db = getDb();
    const row = db.$client
      .prepare("SELECT value, expires_at FROM wechat_token WHERE type = ?")
      .get("access_token") as { value: string; expires_at: number } | undefined;
    expect(row?.value).toBe("AT-WRITTEN");
    expect(Number(row?.expires_at)).toBeGreaterThan(Date.now() + 60_000);

    // Clear mem cache only — SQLite row should still satisfy next call
    __resetMemCacheForTests();
    const second = await getToken("access_token");
    expect(second).toBe("AT-WRITTEN");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(1); // no second fetch
  });
});

describe("getToken — 60s safety buffer", () => {
  it("treats DB row as expired when expiry within SAFETY_BUFFER_MS (60s) and refreshes", async () => {
    const db = getDb();
    // 30s from now — inside the 60s safety buffer, must be treated as expired
    db.$client
      .prepare("INSERT INTO wechat_token (type, value, expires_at) VALUES (?, ?, ?)")
      .run("access_token", "AT-EDGE", Date.now() + 30_000);

    vi.mocked(wechatFetch).mockResolvedValueOnce({
      access_token: "AT-FRESH",
      expires_in: 7200,
    });

    const v = await getToken("access_token");
    expect(v).toBe("AT-FRESH");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(1);
  });
});

describe("getToken — jsapi_ticket recursion", () => {
  it("fetches access_token first, then jsapi_ticket from cgi-bin/ticket/getticket", async () => {
    // First call (access_token), then second (ticket).
    vi.mocked(wechatFetch)
      .mockResolvedValueOnce({ access_token: "AT-X", expires_in: 7200 })
      .mockResolvedValueOnce({ ticket: "TICKET-X", expires_in: 7200 });

    const t = await getToken("jsapi_ticket");
    expect(t).toBe("TICKET-X");
    expect(vi.mocked(wechatFetch)).toHaveBeenCalledTimes(2);

    const firstUrl = String(vi.mocked(wechatFetch).mock.calls[0][0]);
    const secondUrl = String(vi.mocked(wechatFetch).mock.calls[1][0]);
    expect(firstUrl).toContain("api.weixin.qq.com/cgi-bin/token");
    expect(firstUrl).toContain("grant_type=client_credential");
    expect(secondUrl).toContain("api.weixin.qq.com/cgi-bin/ticket/getticket");
    expect(secondUrl).toContain("type=jsapi");
    expect(secondUrl).toContain("access_token=AT-X");
  });
});
