import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthenticatedError } from "@/lib/auth/session";
import { sendOtp } from "@/lib/auth/phone-otp";

/**
 * POST /api/me/phone/verify  — 当前用户向自己手机号发送绑定/换绑 OTP
 *
 * 使用场景：用户登入后（已经有 qy_uid cookie），从 settings 页输入要绑定的手机号 → 收 OTP。
 * 防御：requireUserId 强制登录态；sendOtp 内部 60s/phone rate limit。
 *
 * spec §3.5 / plan §M1.10. M1 阶段 OTP 仅 console.info，M5 接入 SMS gateway。
 *
 * runtime=nodejs：依赖 lib/auth/phone-otp 的 process-local Map（edge runtime 跨实例不共享）。
 */
export const runtime = "nodejs";

// E.164 strict: leading + REQUIRED. The store key is exactly the input phone
// string, so accepting `8613...` AND `+8613...` would cause divergence between
// send and change calls (silent verify-always-fails UX trap).
const PhoneBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUserId();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = PhoneBody.safeParse(json);
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
    return NextResponse.json({ sent: true });
  } catch (e) {
    if (e instanceof UnauthenticatedError) {
      return new NextResponse("unauthorized", { status: 401 });
    }
    throw e;
  }
}
