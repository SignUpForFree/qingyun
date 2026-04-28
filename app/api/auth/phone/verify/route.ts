import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyOtp } from "@/lib/auth/phone-otp";
import { setSessionCookie } from "@/lib/auth/session";
import { ensureUserWithPlaceholderProfile } from "@/lib/auth/ensure-placeholder-profile";
import { getDb } from "@/lib/db/client";
import { phoneBind } from "@/lib/db/schema";

/**
 * POST /api/auth/phone/verify — 浏览器登录验码（公开，未登录可访问）
 *
 * 流程：
 *   1. 验 phone + code 形态
 *   2. verifyOtp（错误 3 次锁定）
 *   3. 已绑过此手机 → 找到 user_id 直接登录
 *   4. 没绑过 → 建新 user + INSERT phone_bind + 占位 profile
 *   5. setSessionCookie 返回 { userId, isNew }，前端按 isNew 决定跳 / 还是 /onboarding
 *
 * runtime=nodejs：依赖 phone-otp 进程内 store + better-sqlite3。
 */
export const runtime = "nodejs";

const Body = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { phone, code } = parsed.data;

  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    const status = result.reason === "too_many_attempts" ? 429 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const db = getDb();

  // 已绑过 phone → 直接登录
  const existing = await db
    .select({ user_id: phoneBind.user_id })
    .from(phoneBind)
    .where(eq(phoneBind.phone_e164, phone))
    .limit(1);

  let userId: string;
  let isNew: boolean;
  if (existing.length > 0 && existing[0]) {
    userId = existing[0].user_id;
    isNew = false;
    // 老用户也要保证占位 profile 存在（极早期账号或 dev-login 后绑定）
    ensureUserWithPlaceholderProfile(userId);
  } else {
    // 新用户：建 user + 占位 profile + 绑手机号（一个事务）
    userId = crypto.randomUUID();
    ensureUserWithPlaceholderProfile(userId);
    const now = new Date().toISOString();
    await db.insert(phoneBind).values({
      user_id: userId,
      phone_e164: phone,
      bound_at: now,
    });
    isNew = true;
  }

  const res = NextResponse.json({ userId, isNew });
  setSessionCookie(res, userId);
  return res;
}
