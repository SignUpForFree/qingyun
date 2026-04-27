import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * /api/chat/set-profile — profile_picker 选档案后落库 (M2.29, spec §4.6)
 *
 * POST { conversationId, profileId } → 校验所有权 → conversations.profile_id = profileId
 *
 * 用途：用户在 profile_picker 卡里选了某个 profile 后，前端调此接口把
 * conversation.profile_id 持久化（让后续八字 / 梅花调用免传 profileId 也能记得选中）。
 */

const bodySchema = z.object({
  conversationId: z.string().min(1),
  profileId: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400);
  }
  const { conversationId, profileId } = parsed.data;

  const userId = await ensureUserId();
  const db = getDb();

  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!conv) return jsonError("会话不存在", 404);

  const [prof] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.user_id, userId)))
    .limit(1);
  if (!prof) return jsonError("档案不存在或无权限", 404);

  await db
    .update(conversations)
    .set({ profile_id: profileId })
    .where(eq(conversations.id, conversationId));

  return Response.json({ ok: true, conversationId, profileId });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
