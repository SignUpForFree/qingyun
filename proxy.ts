import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";
import { shouldSecureCookie } from "@/lib/auth/cookie-flags";

/**
 * Next 16 Proxy（旧名 middleware）— 全局请求拦截
 *
 * 唯一职责：保证每个请求都有一个匿名 user_id cookie。
 *   - 已有 → 透传
 *   - 没有 → 生成 uuid 并 set 到 response
 *
 * 这里不能用 next/headers cookies()，因为 proxy 在 edge runtime 跑；
 * 改用 NextResponse.cookies + NextRequest.cookies。
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(SESSION_COOKIE_KEY)) {
    const uid = crypto.randomUUID();
    response.cookies.set({
      name: SESSION_COOKIE_KEY,
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: shouldSecureCookie(),
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // 排除：静态资源 / 健康检查 / 内部 next 资源
    "/((?!_next/static|_next/image|favicon.ico|api/healthz|images|.*\\.(?:svg|png|jpg|jpeg|webp)).*)",
  ],
};
