import { NextResponse } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";
import { shouldSecureCookie } from "@/lib/auth/cookie-flags";

/**
 * M1.12 退出登录
 *
 * 清 qy_uid cookie 后回首页；后续访问需要鉴权的页会渲染 LoginGate 弹登录窗。
 */
export const runtime = "nodejs";

function buildLogoutResponse(req: Request): NextResponse {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/", url), 302);
  // 用 maxAge=0 清 cookie，比 res.cookies.delete 更可靠（旧 next 版本 delete API 行为差异）
  res.cookies.set(SESSION_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldSecureCookie(),
    maxAge: 0,
    path: "/",
  });
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  return buildLogoutResponse(req);
}

export async function GET(req: Request): Promise<NextResponse> {
  return buildLogoutResponse(req);
}
