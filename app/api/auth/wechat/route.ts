import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/wechat/oauth";

/**
 * M1.6 OAuth 入口（spec §3.1 step 1）
 *
 * 微信内访问入口；生成 nonce + 签名 state，302 跳微信授权页。
 * 回调由 /api/auth/wechat/callback (M1.7) 处理。state 5min TTL 由 signState 内部保证。
 *
 * 浏览器端不再走此路由 — V2 已改为 LoginSheet 弹窗 + 手机号 OTP。
 */
export const runtime = "nodejs";

export async function GET(_req: Request): Promise<Response> {
  const nonce = crypto.randomBytes(8).toString("hex");
  try {
    const url = buildAuthorizeUrl(nonce);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    return NextResponse.json(
      {
        error: "wechat_oauth_pending",
        message: "微信授权暂未开放，请稍后再试",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
