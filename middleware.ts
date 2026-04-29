import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";

/**
 * 鉴权 middleware — cookie-presence-only 防御
 *
 * 策略（V2 弹窗登录）：
 *   - 静态/公开（legal / _next / 头像 / OAuth / healthz）→ 放行
 *   - /api/* 业务接口未登录 → 401 JSON（前端 apiFetch 拦截后弹登录窗）
 *   - 页面路由 → 都放行；服务端 requireUserId 抛 UnauthenticatedError 时
 *     由 page 渲染 LoginGate（client）触发底部 Sheet 弹窗，不再整页跳 /login
 */

const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/healthz",
  "/legal/",
  "/_next/",
  "/favicon",
  "/api/avatar/",
  "/api/logout",
];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(req: NextRequest): NextResponse {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE_KEY)?.value;
  if (session) return NextResponse.next();

  if (path.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
