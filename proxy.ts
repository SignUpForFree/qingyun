import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_KEY } from "@/lib/auth/cookie-keys";

/**
 * 鉴权 proxy（Next.js 16 起 middleware 重命名为 proxy）
 *
 * 双通道鉴权：
 *   - 浏览器（H5 / 桌面）：qy_uid Cookie（httpOnly + sameSite=lax）
 *   - 小程序：Authorization: Bearer <JWT>（lib/auth/jwt.ts 签发）
 *
 * 策略（V2 弹窗登录）：
 *   - 静态/公开（legal / _next / 头像 / OAuth / healthz / wechat-mini 登录）→ 放行
 *   - /api/* 业务接口未登录 → 401 JSON（前端 apiFetch 拦截后弹登录窗 / 小程序触发 wx.login）
 *   - 页面路由 → 都放行；服务端 requireUserId 抛 UnauthenticatedError 时
 *     由 page 渲染 LoginGate（client）触发底部 Sheet 弹窗，不再整页跳 /login
 *
 * 实现注意：
 *   - 跑在 Edge Runtime，不能引 nodejs-only 模块（如 better-sqlite3 / node:crypto verify）；
 *     这里只判断"presence"（cookie 或 Bearer header 存在即放行），真正校验由
 *     lib/auth/session.ts 的 ensureUserId / requireUserId 在 nodejs runtime 内做。
 */

const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/healthz",
  "/legal/",
  "/_next/",
  "/favicon",
  "/api/avatar/",
  "/api/logout",
  // 仅 NODE_ENV !== production 时该 route 实际可用；prod 强制 404，安全
  "/api/dev-login",
];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

/** Edge runtime safe：仅判断"presence"，不解 JWT 签名（验签留给 nodejs session.ts） */
function hasBearer(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  return /^Bearer\s+\S+/i.test(auth);
}

export function proxy(req: NextRequest): NextResponse {
  const path = req.nextUrl.pathname;
  const t0 = Date.now();

  let res: NextResponse;
  let status = 200;

  if (isPublic(path)) {
    res = NextResponse.next();
  } else {
    const session = req.cookies.get(SESSION_COOKIE_KEY)?.value;
    if (session || hasBearer(req)) {
      res = NextResponse.next();
    } else if (path.startsWith("/api/")) {
      status = 401;
      res = new NextResponse(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    } else {
      res = NextResponse.next();
    }
  }

  // 生产环境请求日志 → stdout → docker logs 可见
  if (process.env.NODE_ENV === "production") {
    const ms = Date.now() - t0;
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "-";
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${path} ${status} ${ms}ms ${ip}`
    );
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
