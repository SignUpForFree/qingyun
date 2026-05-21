import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import {
  isRateLimitDisabled,
  isWithinLimit,
  type CountUserMessagesDeps,
  type RateLimitIntent,
  type RateLimitResult,
} from "./rate-limit";

/**
 * 通用入口：用 drizzle 实现 countUserMessages 并跑 isWithinLimit
 *
 * M3.30：可选 `intent` 参数 → 仅统计该 intent 的用户消息，按 intent 限额：
 *   chat 30 / divination 12 / bazi 8 / meihua 8 / dream 8。
 *
 * 兼容：`checkRateLimit(userId)` 不传 intent 走全站 30 老逻辑。
 */
export async function checkRateLimit(
  userId: string,
  intent?: RateLimitIntent,
): Promise<RateLimitResult> {
  if (isRateLimitDisabled()) {
    return { allowed: true, used: 0, remaining: 999_999, limit: 999_999, intent };
  }
  const db = getDb();
  const deps: CountUserMessagesDeps = {
    countUserMessages: async (uid, sinceIso, scopedIntent) => {
      const filters = [
        eq(conversations.user_id, uid),
        eq(messages.role, "user"),
        gte(messages.created_at, sinceIso),
      ];
      if (scopedIntent && scopedIntent !== "default") {
        filters.push(eq(messages.intent, scopedIntent));
      }
      const r = await db
        .select({ n: count() })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversation_id))
        .where(and(...filters));
      return r[0]?.n ?? 0;
    },
  };
  return isWithinLimit(userId, deps, { intent });
}
