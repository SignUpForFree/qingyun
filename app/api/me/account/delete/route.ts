import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { ensureUserId } from "@/lib/auth/session";
import { SESSION_COOKIE_KEY } from "@/lib/auth/cookie-keys";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { reportError } from "@/lib/observability/sentry";

/**
 * POST /api/me/account/delete — 用户主动注销（PIPL §47 删除权）
 *
 * 行为：
 *   1. body 必须含 `confirm: "DELETE"`（防误触）
 *   2. DELETE FROM users WHERE id=? — schema 上所有相关表 ON DELETE CASCADE：
 *      profiles / wechat_bind / phone_bind / conversations / messages / fortunes_*
 *   3. 清 session cookie，让客户端立刻登出
 *   4. 返回 { ok: true }
 *
 * 注意：
 *   - 此接口不可被代刷：必须自己已登录后才能调
 *   - 不要在响应里回显删除条数（避免给爬虫 fingerprint 数据）
 */
export const runtime = "nodejs";

const Body = z.object({
  confirm: z.literal("DELETE"),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* empty body → 校验失败 */
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "must_confirm", hint: "body.confirm 必须为 \"DELETE\"" },
      { status: 400 },
    );
  }

  const userId = await ensureUserId();
  const db = getDb();

  try {
    db.delete(users).where(eq(users.id, userId)).run();
  } catch (e) {
    reportError(e, { route: "/api/me/account/delete", userId });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // 清 cookie（双保险：path / domain 一致才能彻底清掉）
  const store = await cookies();
  store.set(SESSION_COOKIE_KEY, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return NextResponse.json({ ok: true });
}
