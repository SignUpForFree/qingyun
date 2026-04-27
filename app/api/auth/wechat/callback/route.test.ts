import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import { resetEnvCache } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { users, wechatBind, profiles } from "@/lib/db/schema";

/**
 * M1.7 OAuth 回调测试（spec §3.1 step 4-7 / plan §M1.7）
 *
 * 6 条路径：
 *   1. missing state          → 400
 *   2. bad signature          → 401
 *   3. expired state          → 401
 *   4. first-time user        → 302 /onboarding + users/wechat_bind/profiles 各 1 行
 *   5. returning user         → 302 / + 不重复建表 + last_synced_at 更新
 *   6. wechat 40029 (code 重用) → 302 /api/auth/wechat（静默重启 OAuth）
 *
 * 注意：保留 verifyState/signState 真实实现（用于构造合法 state），仅 mock
 * exchangeCodeForToken / fetchUserinfo（不联微信）。
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

vi.mock("@/lib/wechat/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wechat/oauth")>();
  return {
    ...actual,
    exchangeCodeForToken: vi.fn(),
    fetchUserinfo: vi.fn(),
  };
});

import { GET } from "./route";
import { signState, exchangeCodeForToken, fetchUserinfo } from "@/lib/wechat/oauth";

beforeEach(async () => {
  resetEnvCache();
  for (const [k, v] of Object.entries(ENV_BASELINE)) process.env[k] = v;

  // 数据隔离：清干净 users/wechat_bind/profiles（CASCADE 通过 users 删除会带走子表，
  // 但显式 delete 三表更安全；按 FK 顺序：先子后父）
  const db = getDb();
  await db.delete(profiles);
  await db.delete(wechatBind);
  await db.delete(users);

  vi.mocked(exchangeCodeForToken).mockReset();
  vi.mocked(fetchUserinfo).mockReset();
});

afterEach(() => {
  for (const k of Object.keys(ENV_BASELINE)) delete process.env[k];
  resetEnvCache();
});

describe("GET /api/auth/wechat/callback", () => {
  it("rejects missing state -> 400", async () => {
    const r = await GET(
      new Request("https://qingyun.example.com/api/auth/wechat/callback?code=abc"),
    );
    expect(r.status).toBe(400);
  });

  it("rejects bad state signature -> 401", async () => {
    const r = await GET(
      new Request(
        "https://qingyun.example.com/api/auth/wechat/callback?code=abc&state=1.2.3",
      ),
    );
    expect(r.status).toBe(401);
    expect(await r.text()).toMatch(/bad_sig|malformed/);
  });

  it("rejects expired state -> 401", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
    const state = signState("nonce-old");
    vi.setSystemTime(new Date(2026, 0, 1, 0, 6, 0)); // +6 min, past 5 min TTL

    const r = await GET(
      new Request(
        `https://qingyun.example.com/api/auth/wechat/callback?code=abc&state=${state}`,
      ),
    );
    expect(r.status).toBe(401);
    expect(await r.text()).toMatch(/expired/);
    vi.useRealTimers();
  });

  it("first-time user: creates user + wechat_bind + default profile, 302 -> /onboarding", async () => {
    const state = signState("nonce-first");
    vi.mocked(exchangeCodeForToken).mockResolvedValueOnce({
      access_token: "at-1",
      openid: "ox-first",
      expires_in: 7200,
    });
    vi.mocked(fetchUserinfo).mockResolvedValueOnce({
      openid: "ox-first",
      nickname: "测试新用户",
      headimgurl: "https://wx.qlogo.cn/test-avatar.jpg",
    });

    const r = await GET(
      new Request(
        `https://qingyun.example.com/api/auth/wechat/callback?code=ok&state=${state}`,
      ),
    );

    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toMatch(/\/onboarding$/);

    const db = getDb();
    const userRows = await db.select().from(users);
    expect(userRows).toHaveLength(1);
    const userId = userRows[0].id;

    const bindRows = await db
      .select()
      .from(wechatBind)
      .where(eq(wechatBind.openid, "ox-first"));
    expect(bindRows).toHaveLength(1);
    expect(bindRows[0].user_id).toBe(userId);
    expect(bindRows[0].nickname).toBe("测试新用户");
    expect(bindRows[0].avatar_url).toBe("https://wx.qlogo.cn/test-avatar.jpg");

    const profRows = await db.select().from(profiles).where(eq(profiles.user_id, userId));
    expect(profRows).toHaveLength(1);
    expect(profRows[0].is_default).toBe(true);
    expect(profRows[0].nickname).toBe("测试新用户");
    expect(profRows[0].gender).toBe("other");
    expect(profRows[0].birth_date).toBe("1990-01-01");
    expect(profRows[0].birth_time).toBe("12:00");
    expect(profRows[0].birth_calendar).toBe("solar");
    expect(profRows[0].birth_place).toBe("未填");

    const cookie = r.cookies.get("qy_uid");
    expect(cookie?.value).toBe(userId);

    // M1.13: first-time OAuth implies privacy acceptance (spec §3.5)
    expect(userRows[0].privacy_accepted_at).not.toBeNull();
    expect(userRows[0].privacy_accepted_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("returning user: no profile dup, 302 -> /", async () => {
    // 预置：已有用户 u-old + wechat_bind(openid=ox-ret) + profiles(default)
    const db = getDb();
    const oldUserId = "u-old-1234";
    const earlier = "2026-01-01T00:00:00.000Z";
    await db.insert(users).values({
      id: oldUserId,
      created_at: earlier,
      updated_at: earlier,
      privacy_accepted_at: earlier,
    });
    await db.insert(wechatBind).values({
      user_id: oldUserId,
      openid: "ox-ret",
      nickname: "旧昵称",
      avatar_url: "https://wx.qlogo.cn/old.jpg",
      bound_at: earlier,
      last_synced_at: null,
    });
    await db.insert(profiles).values({
      id: "p-old",
      user_id: oldUserId,
      is_default: true,
      nickname: "旧昵称",
      gender: "other",
      birth_date: "1990-01-01",
      birth_time: "12:00",
      birth_calendar: "solar",
      birth_place: "未填",
      created_at: earlier,
      updated_at: earlier,
    });

    const state = signState("nonce-ret");
    vi.mocked(exchangeCodeForToken).mockResolvedValueOnce({
      access_token: "at-2",
      openid: "ox-ret",
      expires_in: 7200,
    });
    vi.mocked(fetchUserinfo).mockResolvedValueOnce({
      openid: "ox-ret",
      nickname: "新昵称",
      headimgurl: "https://wx.qlogo.cn/new.jpg",
    });

    const r = await GET(
      new Request(
        `https://qingyun.example.com/api/auth/wechat/callback?code=ok&state=${state}`,
      ),
    );

    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toMatch(/\/$/);
    expect(r.cookies.get("qy_uid")?.value).toBe(oldUserId);

    const userRowsAfter = await db.select().from(users);
    expect(userRowsAfter).toHaveLength(1);
    // M1.13: returning user keeps original privacy_accepted_at (not overwritten)
    expect(userRowsAfter[0].privacy_accepted_at).toBe(earlier);
    const bindRows = await db.select().from(wechatBind);
    expect(bindRows).toHaveLength(1);
    expect(bindRows[0].nickname).toBe("新昵称");
    expect(bindRows[0].avatar_url).toBe("https://wx.qlogo.cn/new.jpg");
    expect(bindRows[0].last_synced_at).not.toBeNull();
    expect(await db.select().from(profiles)).toHaveLength(1);
  });

  it("wechat errcode 40029 (code reused) -> 302 -> /api/auth/wechat", async () => {
    const state = signState("nonce-40029");
    vi.mocked(exchangeCodeForToken).mockRejectedValueOnce(
      new Error("wechat errcode 40029: code been used"),
    );

    const r = await GET(
      new Request(
        `https://qingyun.example.com/api/auth/wechat/callback?code=reused&state=${state}`,
      ),
    );

    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toMatch(/\/api\/auth\/wechat$/);

    const db = getDb();
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(wechatBind)).toHaveLength(0);
    expect(await db.select().from(profiles)).toHaveLength(0);
  });
});
