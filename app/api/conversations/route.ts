import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";

/**
 * GET /api/conversations — 当前用户的会话列表（HistoryDrawer 用）
 *
 * 返回最近 50 条，按 last_message_at 倒序。
 */
export const runtime = "nodejs";

export async function GET() {
  const userId = await ensureUserId();
  const db = getDb();

  const data = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      last_message_at: conversations.last_message_at,
      created_at: conversations.created_at,
    })
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.last_message_at), desc(conversations.created_at))
    .limit(50);

  return NextResponse.json({ conversations: data });
}
