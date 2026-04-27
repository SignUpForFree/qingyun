import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { setSessionCookie } from "@/lib/auth/session";

/**
 * Dev/test-only 登录捷径 (M3.14)
 *
 * 仅当 NODE_ENV !== "production" 时启用，prod 返 404。让 Playwright 在不走完整
 * 微信 OAuth 流程下也能拿到合法 qy_uid cookie + users 表里的真实记录。
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
  if (process.env.NODE_ENV === "production") {
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

  const db = getDb();
  const now = new Date().toISOString();
  // 幂等：已存在则跳过
  db.insert(users)
    .values({ id: userId, created_at: now, updated_at: now })
    .onConflictDoNothing()
    .run();

  const res = NextResponse.json({ userId });
  setSessionCookie(res, userId);
  return res;
}
