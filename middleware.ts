import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/session";

/**
 * 鉴权 middleware — cookie-presence-only 防御
 *
 * Edge runtime 不能 import better-sqlite3，所以这里不查 wechat_bind。
 * 业务层（page / route）拿到 user_id 后再用 getDb() 校验 bind 完整性。
 *
 * 白名单：/legal/* /api/auth/* /api/healthz /_next/* /favicon
 *
 * 行为：
 *   - 白名单 → 透传
 *   - 有 qy_uid cookie → 透传
 *   - 无 cookie + /api/* → 401 JSON {"error":"unauthorized"}
 *   - 无 cookie + page → 307 redirect /api/auth/wechat
 */

const PUBLIC_PREFIXES = [
  "/api/auth/", // OAuth start + callback (M1.6 / M1.7)
  "/api/healthz", // ops probe
  "/legal/", // privacy / terms (M0.5)
  "/_next/", // Next internals
  "/favicon", // favicon.ico / .png
  "/api/dev-login", // M3.14: dev/test-only 登录捷径（route 内 NODE_ENV gate）
  "/api/avatar/", // M4 头像静态 serve（hash 命名，公开访问）
];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(req: NextRequest): NextResponse {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE_KEY)?.value;
  if (session) return NextResponse.next();

  // 未登录：API 返 401 JSON，页面 302/307 跳 OAuth 入口
  if (path.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return NextResponse.redirect(new URL("/api/auth/wechat", req.url));
}

export const config = {
  // matcher 排除 /_next/static /_next/image 是为了减少 middleware 调用频次
  // (PUBLIC_PREFIXES 里也包含 /_next/，但 matcher 提前 skip 更省 CPU)
  matcher: ["/((?!_next/static|_next/image).*)"],
};
