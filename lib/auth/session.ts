import "server-only";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { shouldSecureCookie } from "./cookie-flags";
import { ensureUserWithPlaceholderProfile } from "./ensure-placeholder-profile";
import { SESSION_COOKIE_KEY } from "./cookie-keys";
import { extractBearer, JwtError, verifyJwt } from "./jwt";

/**
 * 微信绑定的 session（V2.0）
 *
 * - cookie key: qy_uid，值是 users.id
 * - 长期有效（1 年），httpOnly + sameSite=lax (防御 #12)
 * - 由 /api/auth/wechat/callback (M1.7) 在 OAuth 成功后通过 setSessionCookie 写入
 * - middleware.ts (M1.8) 强制：无 cookie -> 302 /api/auth/wechat（页面）/ 401（API）
 *
 * V1.0 的匿名 proxy.ts 已废弃 — V2.0 不再 bootstrap 匿名用户。
 *
 * 注意：SESSION_COOKIE_KEY 单独抽到 ./cookie-keys.ts，让 middleware（edge runtime）
 * 直接 import 常量而不串进 db 依赖链，避免 edge "node:path 找不到" 错误。
 */
export { SESSION_COOKIE_KEY };
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const fromCookie = store.get(SESSION_COOKIE_KEY)?.value ?? null;
  if (fromCookie) return fromCookie;
  // 小程序：Authorization: Bearer <JWT>，签名失败 / 过期 → 视为未登录
  return await getUserIdFromBearer();
}

async function getUserIdFromBearer(): Promise<string | null> {
  try {
    const h = await headers();
    const token = extractBearer(h.get("authorization"));
    if (!token) return null;
    const payload = verifyJwt(token);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch (e) {
    if (e instanceof JwtError) return null;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[session] bearer parse error", e);
    }
    return null;
  }
}

/**
 * dev-only：进程内已 ensure 过的 user_id 缓存，避免每次 ensureUserId 都打一次 db。
 * 重启进程清空（dev 不重要；prod 永远跳过这段逻辑）。
 */
const devBootstrappedUsers = new Set<string>();

export async function ensureUserId(): Promise<string> {
  const existing = await getCurrentUserId();
  if (existing) {
    // dev 自愈：cookie 有 uid 但 db 没该 user（典型场景：刚跑过 db:reset，浏览器旧 cookie）
    // 自动建占位 user + profile，避免下游 13 个 route 全部撞 FOREIGN KEY constraint failed。
    // prod 模式跳过：V2.0 强制微信 OAuth 登录，cookie ↔ db 必须一致；不一致就是真异常应浮现。
    if (process.env.NODE_ENV !== "production" && !devBootstrappedUsers.has(existing)) {
      try {
        ensureUserWithPlaceholderProfile(existing);
        devBootstrappedUsers.add(existing);
      } catch (e) {
        console.error("[dev] ensureUserId auto-bootstrap 失败", e);
      }
    }
    return existing;
  }
  const fresh = crypto.randomUUID();
  await setUserId(fresh);
  if (process.env.NODE_ENV !== "production") {
    try {
      ensureUserWithPlaceholderProfile(fresh);
      devBootstrappedUsers.add(fresh);
    } catch (e) {
      console.error("[dev] ensureUserId fresh-bootstrap 失败", e);
    }
  }
  return fresh;
}

export async function setUserId(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_KEY, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldSecureCookie(),
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export async function clearUserId(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_KEY);
}

/**
 * Response 变体 — 把 qy_uid cookie 写在 NextResponse 上而非 cookies() store。
 *
 * Route handler 在返回 `NextResponse.redirect(...)` 时（如 OAuth 回调跳 /onboarding），
 * 必须把 cookie 挂在那个 response 上；调 cookies().set 不会跟随到 redirect 响应。
 *
 * 防御 #12（V2.0 风险 #5）：sameSite=lax，**不**用 None。微信内嵌浏览器对 SameSite=None
 * 的处理不一致，Lax 能在 OAuth 重定向（top-level navigation）下稳定工作。
 */
export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE_KEY, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldSecureCookie(),
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

/**
 * 必须有 user — 没 cookie 时抛错（API route 使用），让调用方决定是 401 还是兜底。
 * 大部分场景用 ensureUserId 自动建会更好。
 */
export async function requireUserId(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) throw new UnauthenticatedError();
  return id;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("用户会话不存在，请刷新页面");
    this.name = "UnauthenticatedError";
  }
}
