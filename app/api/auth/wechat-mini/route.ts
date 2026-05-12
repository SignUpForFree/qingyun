import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, users, wechatBind } from "@/lib/db/schema";
import {
  code2Session,
  WechatMiniLoginError,
} from "@/lib/wechat/mini-program";
import { signJwt } from "@/lib/auth/jwt";

/**
 * POST /api/auth/wechat-mini
 *
 * 小程序登录入口。请求体：
 *   { code: string, nickname?: string, avatarUrl?: string }
 *
 * 流程：
 *   1. code2Session → openid / session_key / unionid（公开平台合并 H5 账号关键字段）
 *   2. 优先按 unionid 找老账号（H5 用过的同一个微信用户）；其次按 openid
 *   3. 找到 → 老用户路径：刷新昵称 + last_synced_at
 *   4. 找不到 → 新用户路径：tx 内 users + wechat_bind + 默认 profiles
 *   5. 签 JWT 返 { uid, jwt, isNew }
 *
 * 客户端拿到 jwt 后，所有 wx.request 把 Authorization: Bearer <jwt> 带上
 *（proxy.ts 同时认 cookie 和 Bearer）。
 */
export const runtime = "nodejs";

const Body = z.object({
  code: z.string().min(1),
  nickname: z.string().max(64).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
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

  const { code, nickname, avatarUrl } = parsed.data;

  let session: Awaited<ReturnType<typeof code2Session>>;
  try {
    session = await code2Session(code);
  } catch (e) {
    if (e instanceof WechatMiniLoginError) {
      return NextResponse.json(
        {
          error: "wechat_login_failed",
          errcode: e.errcode,
          message: e.message,
        },
        { status: e.errcode === 40029 ? 401 : 502 },
      );
    }
    throw e;
  }

  const db = getDb();
  const now = new Date().toISOString();

  // 1) 优先 unionid 合并 H5 账号
  let userId: string | null = null;
  let isNew = false;

  if (session.unionid) {
    const byUnion = await db
      .select()
      .from(wechatBind)
      .where(eq(wechatBind.unionid, session.unionid))
      .limit(1);
    if (byUnion[0]) userId = byUnion[0].user_id;
  }

  // 2) 没有 unionid 命中 → 用 openid 查
  if (!userId) {
    const byOpenid = await db
      .select()
      .from(wechatBind)
      .where(eq(wechatBind.openid, session.openid))
      .limit(1);
    if (byOpenid[0]) userId = byOpenid[0].user_id;
  }

  if (userId) {
    // 老用户：刷新昵称头像 + last_synced_at + unionid 回填（旧记录可能没 unionid）
    const updates: Record<string, unknown> = {
      last_synced_at: now,
    };
    if (nickname) updates.nickname = nickname;
    if (avatarUrl) updates.avatar_url = avatarUrl;
    if (session.unionid) updates.unionid = session.unionid;
    await db
      .update(wechatBind)
      .set(updates)
      .where(eq(wechatBind.user_id, userId));
    // 隐私：保留首次接受时间，不覆盖已有
    await db
      .update(users)
      .set({ privacy_accepted_at: now })
      .where(and(eq(users.id, userId), isNull(users.privacy_accepted_at)));
  } else {
    // 新用户：tx 建 users + wechat_bind + 默认 profile
    userId = crypto.randomUUID();
    isNew = true;
    db.transaction((tx) => {
      tx.insert(users)
        .values({
          id: userId!,
          created_at: now,
          updated_at: now,
          privacy_accepted_at: now,
        })
        .run();
      tx.insert(wechatBind)
        .values({
          user_id: userId!,
          openid: session.openid,
          unionid: session.unionid,
          nickname: nickname ?? null,
          avatar_url: avatarUrl || null,
          raw_userinfo: JSON.stringify({
            from: "wechat-mini",
            session_key_len: session.session_key.length,
          }),
          bound_at: now,
          last_synced_at: now,
        })
        .run();
      tx.insert(profiles)
        .values({
          id: crypto.randomUUID(),
          user_id: userId!,
          is_default: true,
          nickname: nickname || "我自己",
          avatar_url: avatarUrl || null,
          gender: "other",
          birth_date: "1990-01-01",
          birth_time: "12:00",
          birth_calendar: "solar",
          birth_place: "未填",
          created_at: now,
          updated_at: now,
        })
        .run();
    });
  }

  const jwt = signJwt({ sub: userId }, { expiresInSec: 30 * 24 * 60 * 60 });

  return NextResponse.json({
    uid: userId,
    jwt,
    isNew,
  });
}
