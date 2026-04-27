import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/wechat/oauth";

/**
 * M1.6 OAuth 入口（spec §3.1 step 1）
 *
 * 未登录用户被 middleware (M1.8) 重定向到此，生成 nonce + 签名 state，
 * 302 跳到微信授权页。回调由 /api/auth/wechat/callback (M1.7) 处理。
 *
 * 无 DB / 无副作用。state 5min TTL 由 signState 内部保证。
 *
 * Fallback：M5 微信 OAuth 接好之前，缺 WECHAT_APPID 等 env 会让
 * buildAuthorizeUrl 抛错 → 之前是 500，现在改为：
 *   - ALLOW_DEV_LOGIN=1 → 302 跳 /api/dev-login（无缝降级让运营/QA 能进）
 *   - 否则 503 + 友好 JSON（避免线上一片红 500 日志）
 */
export const runtime = "nodejs";

export async function GET(_req: Request): Promise<Response> {
  const nonce = crypto.randomBytes(8).toString("hex");
  try {
    const url = buildAuthorizeUrl(nonce);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (process.env.ALLOW_DEV_LOGIN === "1") {
      // dev-login 旁路：直接 302 跳到 dev-login GET（自动 set cookie + 跳 /）
      return new NextResponse(null, {
        status: 302,
        headers: { Location: "/api/dev-login" },
      });
    }
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
