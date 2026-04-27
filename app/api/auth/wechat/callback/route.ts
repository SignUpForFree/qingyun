import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import {
  verifyState,
  exchangeCodeForToken,
  fetchUserinfo,
  type OAuthTokenResp,
} from "@/lib/wechat/oauth";
import { getDb } from "@/lib/db/client";
import { users, wechatBind, profiles } from "@/lib/db/schema";
import { setSessionCookie } from "@/lib/auth/session";

/**
 * M1.7 OAuth 回调（spec §3.1 step 4-7 / plan §M1.7）
 *
 * 微信带 ?code & ?state 回跳本路由：
 *   1. verifyState：HMAC + 5min TTL（防 CSRF + 防重放）
 *   2. exchangeCodeForToken：code → access_token（per-user，one-shot）
 *   3. fetchUserinfo：拿 openid/nickname/headimgurl
 *   4. upsert wechat_bind：openid 唯一索引；首次 → 同时建 users + 默认 profiles
 *   5. setSessionCookie：把 qy_uid 挂到 redirect 响应上
 *   6. 302：首次 → /onboarding；老用户 → /
 *
 * 特殊处理：
 *   - errcode 40029 (code 已使用 / 用户回退/分享) → 302 重启 OAuth (/api/auth/wechat)
 *     防御 #20 / V2.0 风险 #1：code 是一次性的，浏览器后退/分享会触发重用，
 *     静默重启比报 500 体验好。
 *
 * 占位 profile（onboarding M1.11 必须覆盖）：
 *   gender=other / 1990-01-01 / 12:00 / solar / "未填"
 */
export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Path 1: 缺 state / code → 400（plan 里写了 fallback 跳 OAuth，但测试断言 400 更清晰）
  if (!state) return new NextResponse("missing state", { status: 400 });
  if (!code) return new NextResponse("missing code", { status: 400 });

  // Path 2 & 3: state 校验
  const v = verifyState(state);
  if (!v.ok) {
    return new NextResponse(`invalid state: ${v.reason}`, { status: 401 });
  }

  // Path 6: 40029 (code 重用) — 静默重启 OAuth
  let token: OAuthTokenResp;
  try {
    token = await exchangeCodeForToken(code);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/errcode\s*40029/.test(msg)) {
      return NextResponse.redirect(new URL("/api/auth/wechat", url), 302);
    }
    throw e;
  }

  const info = await fetchUserinfo(token.access_token, token.openid);
  const db = getDb();
  const now = new Date().toISOString();

  // 查 wechat_bind 是否已存在（按 openid 唯一）
  const existing = await db
    .select()
    .from(wechatBind)
    .where(eq(wechatBind.openid, info.openid))
    .limit(1);

  let userId: string;
  let isFirstTime = false;

  if (existing[0]) {
    // Path 5: 老用户 — 同步昵称/头像，更新 last_synced_at
    userId = existing[0].user_id;
    await db
      .update(wechatBind)
      .set({
        nickname: info.nickname,
        avatar_url: info.headimgurl,
        last_synced_at: now,
      })
      .where(eq(wechatBind.user_id, userId));
    // M1.13 backfill: returning users registered before privacy gate shipped
    // have privacy_accepted_at = NULL. PIPL §17 ("明确同意") would silently
    // exclude them from compliance reporting. Stamp `now` only when NULL —
    // never overwrite an existing acceptance timestamp.
    await db
      .update(users)
      .set({ privacy_accepted_at: now })
      .where(and(eq(users.id, userId), isNull(users.privacy_accepted_at)));
  } else {
    // Path 4: 首次用户 — 建 users + wechat_bind + 默认 profile
    // Atomic via db.transaction：任一插入失败（FK / 并发 unique violation / 进程崩溃）
    // 全部回滚，避免孤儿 users 行或缺 profile 的用户破坏 M1.11 onboarding。
    // 注意：drizzle better-sqlite3 的 transaction 是同步的（底层 better-sqlite3 限制），
    // callback 不能返回 Promise，所以这里不用 async / await，每条语句用 .run() 立即执行。
    userId = crypto.randomUUID();
    db.transaction((tx) => {
      // M1.13: OAuth completion implies acceptance of privacy policy
      // (per spec §3.5; /legal/privacy is shown upfront via permission prompt + footer link).
      tx.insert(users)
        .values({
          id: userId,
          created_at: now,
          updated_at: now,
          privacy_accepted_at: now,
        })
        .run();
      tx.insert(wechatBind).values({
        user_id: userId,
        openid: info.openid,
        unionid: info.unionid,
        nickname: info.nickname,
        avatar_url: info.headimgurl,
        raw_userinfo: JSON.stringify(info),
        bound_at: now,
        last_synced_at: now,
      }).run();
      tx.insert(profiles).values({
        id: crypto.randomUUID(),
        user_id: userId,
        is_default: true,
        nickname: info.nickname,
        avatar_url: info.headimgurl,
        gender: "other",
        birth_date: "1990-01-01",
        birth_time: "12:00",
        birth_calendar: "solar",
        birth_place: "未填",
        created_at: now,
        updated_at: now,
      }).run();
    });
    isFirstTime = true;
  }

  const target = isFirstTime ? "/onboarding" : "/";
  const res = NextResponse.redirect(new URL(target, url), 302);
  setSessionCookie(res, userId);
  return res;
}
