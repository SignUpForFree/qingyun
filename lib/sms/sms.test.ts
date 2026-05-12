import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { MockSmsProvider } from "./mock";
import { TencentSmsProvider } from "./tencent";
import { createSmsProvider } from "./index";

describe("MockSmsProvider", () => {
  it("returns ok and logs to console.info in dev", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const p = new MockSmsProvider();
    const res = await p.send({ phone: "+8613800138000", params: ["123456", "10"] });
    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\[sms:mock\].*\+8613800138000/),
    );
    spy.mockRestore();
  });
});

describe("TencentSmsProvider", () => {
  beforeEach(() => {
    process.env.TENCENT_SMS_SECRET_ID = "AKIDxxxxxxxxx";
    process.env.TENCENT_SMS_SECRET_KEY = "test-secret-key";
    process.env.TENCENT_SMS_SDK_APP_ID = "1400000000";
    process.env.TENCENT_SMS_SIGN_NAME = "测试签名";
    process.env.TENCENT_SMS_TEMPLATE_ID_OTP = "1234567";
  });
  afterEach(() => {
    delete process.env.TENCENT_SMS_SECRET_ID;
    delete process.env.TENCENT_SMS_SECRET_KEY;
    delete process.env.TENCENT_SMS_SDK_APP_ID;
    delete process.env.TENCENT_SMS_SIGN_NAME;
    delete process.env.TENCENT_SMS_TEMPLATE_ID_OTP;
    vi.restoreAllMocks();
  });

  it("returns config-missing if secrets blank", async () => {
    delete process.env.TENCENT_SMS_SECRET_ID;
    const p = new TencentSmsProvider();
    const res = await p.send({ phone: "+8613800138000", params: ["123456", "10"] });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("config-missing");
  });

  it("returns ok when API responds with SendStatusSet[0].Code=Ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: {
            SendStatusSet: [{ Code: "Ok", Message: "send success" }],
            RequestId: "req-1",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const p = new TencentSmsProvider();
    const res = await p.send({
      phone: "13800138000",
      params: ["123456", "10"],
    });
    expect(res.ok).toBe(true);
  });

  it("maps tencent error code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: {
            Error: { Code: "FailedOperation.SignatureIncorrectOrUnapproved" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const p = new TencentSmsProvider();
    const res = await p.send({ phone: "+8613800138000", params: ["x", "y"] });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/^tc-error:/);
  });
});

describe("createSmsProvider factory", () => {
  afterEach(() => {
    delete process.env.SMS_PROVIDER;
  });

  it("explicit kind=mock returns MockSmsProvider", () => {
    const p = createSmsProvider({ kind: "mock" });
    expect(p.name).toBe("mock");
  });

  it("env SMS_PROVIDER=tencent returns TencentSmsProvider", () => {
    process.env.SMS_PROVIDER = "tencent";
    const p = createSmsProvider();
    expect(p.name).toBe("tencent");
  });
});
