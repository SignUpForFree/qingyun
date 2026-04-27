import { NextResponse } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";
import { shouldSecureCookie } from "@/lib/auth/cookie-flags";

/**
 * M1.12 退出登录（最小占位）
 *
 * - 清掉 qy_uid cookie 后 302 跳 /api/auth/wechat
 * - POST 是 /me 页里 <form method="POST"> 的目标
 * - 提供 GET 兜底（直接访问 /api/auth/logout）方便排错；行为同 POST
 *
 * 注意：直接在 NextResponse 上覆盖 cookie 而不调 clearUserId()，
 * 因为 cookies().delete 不会跟随到 redirect 响应（同 setSessionCookie 的注释）。
 */
export const runtime = "nodejs";

function buildLogoutResponse(req: Request): NextResponse {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/api/auth/wechat", url), 302);
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
