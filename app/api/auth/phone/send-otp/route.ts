import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOtp, isMockOtpBypass, getFixedOtpCode } from "@/lib/auth/phone-otp";

/**
 * POST /api/auth/phone/send-otp — 浏览器登录前发码（公开，未登录可访问）
 *
 * 与 /api/me/phone/verify 区别：
 *   - /api/me/phone/verify 是登录后的"绑定/换绑发码"
 *   - /api/auth/phone/send-otp 是登录前的"登录用发码"
 *
 * 流程：
 *   1. 验 phone 形态（E.164）
 *   2. sendOtp 进 store（dev 模式 console.info；M5 接 SMS gateway 替换）
 *   3. 同 phone 60s 限流（phone-otp 内部 rate limit）
 *
 * runtime=nodejs：phone-otp 用进程内 Map（M5 改 SQLite 仍 nodejs）。
 */
export const runtime = "nodejs";

const Body = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "phone 必须 E.164 形式 +CCNNNNNNN"),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await sendOtp(parsed.data.phone);
  if (!result.sent) {
    if (result.cooldownMs) {
      return NextResponse.json(
        { error: "rate_limited", cooldownMs: result.cooldownMs },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "sms_failed", reason: result.reason ?? "unknown" },
      { status: 502 },
    );
  }
  // mock=true → 前端 toast "任意 6 位即可"；fixedCode → 前端 toast 显示固定验证码
  return NextResponse.json({
    ok: true,
    mock: isMockOtpBypass(),
    fixedCode: getFixedOtpCode(),
  });
}
