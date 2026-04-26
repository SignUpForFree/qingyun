import "server-only";
import { cookies } from "next/headers";

/**
 * 本地匿名 session — 替代 Supabase signInAnonymously
 *
 * - cookie key: qy_uid，存 uuid
 * - 长期有效（1 年），httpOnly + sameSite=lax
 * - 首次访问时由 proxy.ts 自动生成
 *
 * 简化模型：
 *   - 没有"账号"概念，只有匿名 user_id（uuid）
 *   - 全部 user 数据通过 user_id 字段过滤（不依赖 RLS，service 层显式 where）
 *   - 未来要接微信 / 邮箱登录时，把 uid 与微信 openid 关联即可
 */
export const SESSION_COOKIE_KEY = "qy_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_KEY)?.value ?? null;
}

export async function ensureUserId(): Promise<string> {
  const existing = await getCurrentUserId();
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  await setUserId(fresh);
  return fresh;
}

export async function setUserId(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_KEY, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export async function clearUserId(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_KEY);
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
