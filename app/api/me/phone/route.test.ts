import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireUserId: vi.fn(),
  };
});

vi.mock("@/lib/auth/phone-otp", () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  __resetForTests: vi.fn(),
}));

import { POST as VerifyPOST } from "./verify/route";
import { POST as ChangePOST } from "./change/route";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { sendOtp, verifyOtp } from "@/lib/auth/phone-otp";
import { getDb } from "@/lib/db/client";
import { phoneBind, users } from "@/lib/db/schema";
import { resetEnvCache } from "@/lib/env";
import { eq } from "drizzle-orm";

/**
 * M1.10 phone routes — integration: route schema + status code + DB upsert
 *
 * 单元化策略：mock auth + phone-otp（让 verify/sendOtp 行为可控），
 * DB 层走真实 SQLite（confirm phoneBind upsert 行为）。
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

const USER_ID = "u-otp-test-1";
const OTHER_USER_ID = "u-otp-test-2";

beforeEach(async () => {
  resetEnvCache();
  for (const [k, v] of Object.entries(ENV_BASELINE)) process.env[k] = v;

  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(USER_ID);

  // Clean DB rows + ensure user FK exists（phoneBind.user_id 是 FK）
  const db = getDb();
  await db.delete(phoneBind);
  await db.delete(users).where(eq(users.id, USER_ID));
  await db.delete(users).where(eq(users.id, OTHER_USER_ID));
  await db.insert(users).values({ id: USER_ID });
  await db.insert(users).values({ id: OTHER_USER_ID });
});

afterEach(() => {
  for (const k of Object.keys(ENV_BASELINE)) delete process.env[k];
  resetEnvCache();
});

function makeReq(path: string, body: unknown) {
  return new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/me/phone/verify", () => {
  it("returns { sent: true } on successful send", async () => {
    vi.mocked(sendOtp).mockReturnValueOnce({ sent: true });

    const r = await VerifyPOST(makeReq("/api/me/phone/verify", { phone: "+8613800138000" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ sent: true });
    expect(vi.mocked(sendOtp)).toHaveBeenCalledWith("+8613800138000");
  });

  it("returns 429 with cooldownMs when rate-limited", async () => {
    vi.mocked(sendOtp).mockReturnValueOnce({ sent: false, cooldownMs: 42_000 });

    const r = await VerifyPOST(makeReq("/api/me/phone/verify", { phone: "+8613800138000" }));
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body.error).toBe("rate_limited");
    expect(body.cooldownMs).toBe(42_000);
  });

  it("rejects invalid phone format with 400", async () => {
    const r = await VerifyPOST(makeReq("/api/me/phone/verify", { phone: "not-a-phone" }));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("validation");
    expect(vi.mocked(sendOtp)).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await VerifyPOST(makeReq("/api/me/phone/verify", "not-json"));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("invalid_json");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await VerifyPOST(makeReq("/api/me/phone/verify", { phone: "+8613800138000" }));
    expect(r.status).toBe(401);
    expect(vi.mocked(sendOtp)).not.toHaveBeenCalled();
  });
});

describe("POST /api/me/phone/change", () => {
  it("inserts phone_bind row on first bind (verify ok)", async () => {
    vi.mocked(verifyOtp).mockReturnValueOnce({ ok: true });

    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "123456" }),
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ ok: true });

    const db = getDb();
    const [row] = await db
      .select()
      .from(phoneBind)
      .where(eq(phoneBind.user_id, USER_ID));
    expect(row?.phone_e164).toBe("+8613800138000");
    expect(row?.bound_at).toBeTruthy();
    expect(row?.last_changed_at).toBeNull();
  });

  it("updates phone_bind row + sets last_changed_at on rebind", async () => {
    const db = getDb();
    await db.insert(phoneBind).values({
      user_id: USER_ID,
      phone_e164: "+8613800000000",
    });

    vi.mocked(verifyOtp).mockReturnValueOnce({ ok: true });
    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613911119999", code: "123456" }),
    );
    expect(r.status).toBe(200);

    const [row] = await db
      .select()
      .from(phoneBind)
      .where(eq(phoneBind.user_id, USER_ID));
    expect(row?.phone_e164).toBe("+8613911119999");
    expect(row?.last_changed_at).toBeTruthy();
  });

  it("returns 400 verify_failed with reason when OTP wrong", async () => {
    vi.mocked(verifyOtp).mockReturnValueOnce({ ok: false, reason: "wrong" });

    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "999999" }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("verify_failed");
    expect(body.reason).toBe("wrong");

    // 没有 verify 通过就不应写 DB
    const db = getDb();
    const rows = await db.select().from(phoneBind).where(eq(phoneBind.user_id, USER_ID));
    expect(rows.length).toBe(0);
  });

  it("returns 400 with reason=expired when OTP expired", async () => {
    vi.mocked(verifyOtp).mockReturnValueOnce({ ok: false, reason: "expired" });

    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "123456" }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.reason).toBe("expired");
  });

  it("returns 409 phone_already_bound when phone is taken by another user", async () => {
    // 另一个用户先绑了这个号
    const db = getDb();
    await db.insert(phoneBind).values({
      user_id: OTHER_USER_ID,
      phone_e164: "+8613800138000",
    });

    vi.mocked(verifyOtp).mockReturnValueOnce({ ok: true });
    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "123456" }),
    );
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body.error).toBe("phone_already_bound");

    // 当前用户仍未绑定
    const rows = await db.select().from(phoneBind).where(eq(phoneBind.user_id, USER_ID));
    expect(rows.length).toBe(0);
  });

  it("rejects invalid phone format with 400 validation", async () => {
    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "bad", code: "123456" }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("validation");
    expect(vi.mocked(verifyOtp)).not.toHaveBeenCalled();
  });

  it("rejects non-6-digit code with 400 validation", async () => {
    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "12345" }),
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("validation");
    expect(vi.mocked(verifyOtp)).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await ChangePOST(makeReq("/api/me/phone/change", "not-json"));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("invalid_json");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUserId).mockRejectedValueOnce(new UnauthenticatedError());
    const r = await ChangePOST(
      makeReq("/api/me/phone/change", { phone: "+8613800138000", code: "123456" }),
    );
    expect(r.status).toBe(401);
    expect(vi.mocked(verifyOtp)).not.toHaveBeenCalled();
  });
});
