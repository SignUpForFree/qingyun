import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { setSessionCookie } from "@/lib/auth/session";

/**
 * 幂等地保证 user + 默认 profile 占位都存在。
 * Onboarding step3 的 PUT /api/me/profiles/[id] 依赖默认档案存在，
 * 否则会报 "默认档案缺失"。OAuth callback 已在 transaction 里建占位
 * (app/api/auth/wechat/callback/route.ts)，dev-login 必须对齐。
 */
function ensureUserWithPlaceholderProfile(userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(users)
      .values({ id: userId, created_at: now, updated_at: now })
      .onConflictDoNothing()
      .run();
    const existing = tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1)
      .all();
    if (existing.length === 0) {
      tx.insert(profiles)
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          is_default: true,
          nickname: "我",
          gender: "other",
          birth_date: "1990-01-01",
          birth_time: "12:00",
          birth_calendar: "solar",
          birth_place: "未填",
          created_at: now,
          updated_at: now,
        })
        .run();
    }
  });
}

/**
 * Dev/test-only 登录捷径 (M3.14)
 *
 * 默认仅当 NODE_ENV !== "production" 时启用。
 * 生产灰度阶段微信 OAuth 还没接，可以临时设 ALLOW_DEV_LOGIN=1 强制开启
 * 让运营/QA 能拿到 qy_uid cookie 看 UI（M5 接好微信 OAuth 后必须删此 env）。
 *
 * POST /api/dev-login → { userId }
 *   - 接受可选 { uid }（默认随机 UUID）
 *   - 幂等 INSERT INTO users
 *   - 在响应上挂 qy_uid cookie
 *
 * Middleware 已通过 PUBLIC_PREFIXES 的 `/api/dev-login` 放行。
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const allowOverride = process.env.ALLOW_DEV_LOGIN === "1";
  if (process.env.NODE_ENV === "production" && !allowOverride) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let uid: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { uid?: string };
    uid = body?.uid;
  } catch {
    /* 没 body 也允许 */
  }
  const userId = uid && uid.length > 0 ? uid : crypto.randomUUID();
  ensureUserWithPlaceholderProfile(userId);

  const res = NextResponse.json({ userId });
  setSessionCookie(res, userId);
  return res;
}

/**
 * GET /api/dev-login?uid=xxx&redirect=/ — 浏览器友好的"一键登录"入口
 *
 * 用 query 参数拿 uid（可省，默认随机），自动 set-cookie 后 302 跳到 redirect
 * （默认 /）。让运营/QA 直接复制 URL 在浏览器栏粘贴就能进入应用，免 DevTools。
 *
 * 示例：
 *   /api/dev-login                                 → 新建匿名 user，跳 /
 *   /api/dev-login?uid=abc-123                      → 用指定 uid 登录，跳 /
 *   /api/dev-login?redirect=/onboarding             → 跳 /onboarding
 */
export async function GET(req: Request) {
  const allowOverride = process.env.ALLOW_DEV_LOGIN === "1";
  if (process.env.NODE_ENV === "production" && !allowOverride) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get("uid") || undefined;
  // 仅允许 site-internal 同源相对路径（防开放重定向）
  const rawRedirect = url.searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
    ? rawRedirect
    : "/";

  const userId = uid && uid.length > 0 ? uid : crypto.randomUUID();
  ensureUserWithPlaceholderProfile(userId);

  // 直接用相对路径，避开 req.url 在容器里是 0.0.0.0 的坑（NextResponse.redirect
  // 要求绝对 URL，所以手工组 Response 加 Location 头）。
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: safeRedirect },
  });
  setSessionCookie(res, userId);
  return res;
}
