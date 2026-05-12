import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  users,
  profiles,
  phoneBind,
  wechatBind,
  conversations,
  messages,
  fortunesDaily,
  fortunesWeekly,
  fortunesMonthly,
} from "@/lib/db/schema";

/**
 * GET /api/me/account/export — 个人信息导出（PIPL §45 数据可携权）
 *
 * 行为：
 *   - 把当前用户的所有可识别数据打包成 JSON 一次性下载
 *   - 不含 OTP / wechat session_key 等敏感凭据（已不入库或脱敏）
 *   - Content-Disposition 强制下载：qingyun-export-<userIdHead>-<ts>.json
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const userId = await ensureUserId();
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const profilesRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId));
  const profileIds = profilesRows.map((p) => p.id);

  const [phoneRow] = await db
    .select()
    .from(phoneBind)
    .where(eq(phoneBind.user_id, userId))
    .limit(1);
  const [wechatRow] = await db
    .select()
    .from(wechatBind)
    .where(eq(wechatBind.user_id, userId))
    .limit(1);

  const conversationsRows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.user_id, userId));
  const conversationIds = conversationsRows.map((c) => c.id);

  const messagesRows = conversationIds.length
    ? await db
        .select()
        .from(messages)
        .where(inArray(messages.conversation_id, conversationIds))
    : [];

  const fortunesDailyRows = profileIds.length
    ? await db
        .select()
        .from(fortunesDaily)
        .where(inArray(fortunesDaily.profile_id, profileIds))
    : [];
  const fortunesWeeklyRows = profileIds.length
    ? await db
        .select()
        .from(fortunesWeekly)
        .where(inArray(fortunesWeekly.profile_id, profileIds))
    : [];
  const fortunesMonthlyRows = profileIds.length
    ? await db
        .select()
        .from(fortunesMonthly)
        .where(inArray(fortunesMonthly.profile_id, profileIds))
    : [];

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    user,
    phone: phoneRow ?? null,
    wechat: wechatRow ? sanitizeWechat(wechatRow) : null,
    profiles: profilesRows,
    fortunes: {
      daily: fortunesDailyRows,
      weekly: fortunesWeeklyRows,
      monthly: fortunesMonthlyRows,
    },
    conversations: conversationsRows,
    messages: messagesRows,
  };

  const body = JSON.stringify(payload, null, 2);
  const filename = `qingyun-export-${userId.slice(0, 8)}-${Date.now()}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

type WechatRow = {
  user_id: string;
  openid: string;
  unionid: string | null;
  nickname: string | null;
  avatar_url: string | null;
  raw_userinfo: string | null;
  bound_at: string;
  last_synced_at: string | null;
  last_oa_error: string | null;
};

function sanitizeWechat(row: WechatRow) {
  // raw_userinfo 可能含 session_key / unionid 之外的临时凭据，导出时移除
  const { raw_userinfo: _r, ...rest } = row;
  return rest;
}
