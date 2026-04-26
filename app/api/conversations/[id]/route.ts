import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";

/**
 * DELETE /api/conversations/[id] — 删除会话（含级联 messages + divination_records）
 *
 * 校验：
 *   - 必须是当前 user 自己的会话
 *   - 不存在 / 不归属 → 404
 *
 * 删除：
 *   - drizzle 直接删 conversations.id
 *   - schema 上 messages.conversation_id ON DELETE CASCADE，
 *     divination_records.message_id ON DELETE CASCADE 已配 → 级联清理
 */
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "缺少会话 id" }, { status: 400 });
  }

  const userId = await ensureUserId();
  const db = getDb();

  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)))
    .limit(1);

  if (!owned[0]) {
    return NextResponse.json({ error: "会话不存在或无权操作" }, { status: 404 });
  }

  await db.delete(conversations).where(eq(conversations.id, id));

  return NextResponse.json({ ok: true });
}
