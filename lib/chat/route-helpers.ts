/**
 * 占卜路由共享 helpers — qianwen / qianwen/explain / bazi / meihua / dream
 *
 * 这些路由共享 5 个机械重复的步骤：
 *   1. JSON parse + zod 校验 + 400 兜底
 *   2. ensureUserId + checkRateLimit + 429
 *   3. conversation 归属校验 + 404
 *   4. update conversations.last_intent + last_message_at（每次回合后续刷）
 *   5. 错误响应统一 envelope { error: string }
 *
 * 把它们集中到这里，让每个 route 文件只剩业务逻辑（抽签、起卦、解梦本体）。
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ZodSchema } from "zod";
import { getDb } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";
import { isAiGatewayConfigured } from "@/lib/ai/gateway";
import {
  formatRateLimitDeniedMessage,
  type RateLimitIntent,
} from "@/lib/ai/rate-limit";

type DrizzleDb = ReturnType<typeof getDb>;

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const AI_NOT_CONFIGURED_MSG =
  "AI 服务未配置：请在项目根目录 .env.local 填写 AI_GATEWAY_BASE_URL 与 AI_GATEWAY_API_KEY（ofox 控制台获取），保存后重启 pnpm dev";

/** 调用 AI 前检查网关 key；未配置时返回 503 JSON（避免 SSE 里笼统的「AI 卡了一下」） */
export function requireAiGateway(): Response | null {
  if (isAiGatewayConfigured()) return null;
  return jsonError(AI_NOT_CONFIGURED_MSG, 503);
}

/**
 * 解析 + 校验 JSON body。
 * 失败：返回 Response（直接 return 给客户端）。
 * 成功：返回 { data }。
 */
export async function parseJsonBody<T extends ZodSchema>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: never } | { error: Response; data?: never }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError("请求体不是合法 JSON", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: jsonError(parsed.error.issues[0]?.message ?? "校验失败", 400) };
  }
  return { data: parsed.data };
}

/**
 * 速率限制守卫。allowed=false 时返回 429 Response，调用方 return；
 * allowed=true 时返回 null，调用方继续。
 */
export async function enforceRateLimit(
  userId: string,
  intent: RateLimitIntent,
  label: string,
): Promise<Response | null> {
  const limit = await checkRateLimit(userId, intent);
  if (limit.allowed) return null;
  return jsonError(formatRateLimitDeniedMessage(intent, limit, label), 429);
}

/**
 * 校验会话属于当前用户。返回 null = 通过；返回 Response = 404 已构造好。
 */
export async function requireConversationOwned(
  db: DrizzleDb,
  conversationId: string,
  userId: string,
): Promise<Response | null> {
  const owned = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
    .limit(1);
  if (!owned[0]) return jsonError("会话不存在", 404);
  return null;
}

/**
 * 一次回合（user→assistant 一对消息）写完后，刷新会话活跃信息。
 * HistoryDrawer 按 last_message_at 倒序排，必须每次回合都更新。
 */
export async function bumpConversationActivity(
  db: DrizzleDb,
  conversationId: string,
  intent: string,
): Promise<void> {
  await db
    .update(conversations)
    .set({ last_intent: intent, last_message_at: new Date().toISOString() })
    .where(eq(conversations.id, conversationId));
}
