import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, messages } from "@/lib/db/schema";
import {
  isWithinLimit,
  type CountUserMessagesDeps,
  type RateLimitResult,
} from "./rate-limit";

/**
 * 通用入口：用 drizzle 实现 countUserMessages 并跑 isWithinLimit
 *
 * 给 /api/chat 和 4 个 /api/divination/* 路由复用，避免每个路由都重写一段查询。
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const db = getDb();
  const deps: CountUserMessagesDeps = {
    countUserMessages: async (uid, sinceIso) => {
      const r = await db
        .select({ n: count() })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversation_id))
        .where(
          and(
            eq(conversations.user_id, uid),
            eq(messages.role, "user"),
            gte(messages.created_at, sinceIso),
          ),
        );
      return r[0]?.n ?? 0;
    },
  };
  return isWithinLimit(userId, deps);
}
