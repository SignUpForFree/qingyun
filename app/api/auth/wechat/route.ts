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
 */
export const runtime = "nodejs";

export async function GET(_req: Request): Promise<Response> {
  const nonce = crypto.randomBytes(8).toString("hex");
  const url = buildAuthorizeUrl(nonce);
  return NextResponse.redirect(url, 302);
}
