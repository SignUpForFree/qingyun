/**
 * 用户级限流（每小时上限）
 *
 * 当前实现以 conversations.user_id + messages.role='user' 作为速率指标，
 * MVP 简化版：单用户对话数远小于全站量，全站维度按用户聚合后 30 条/小时是宽口径上限。
 *
 * P1 阶段：B5 之前没有 supabase admin client，本模块只暴露：
 *   - HOURLY_LIMIT 常量
 *   - 纯函数 evaluateLimit(used, limit) 用于核心逻辑测试
 *   - 抽象 isWithinLimit(userId, deps) 接受可注入的 count 函数
 *
 * B5 之后会有一个 createAdmin().count() 实际调用 supabase 的 wrapper。
 */

export const HOURLY_LIMIT = Number(process.env.RATE_LIMIT_PER_USER_HOURLY ?? 30);

/**
 * M3.30: intent-specific 限额（每小时）
 *
 * - chat：闲聊轻成本 → 30
 * - bazi / meihua：长 prompt 高成本 → 8
 * - divination（抽签 step1+step2）：中成本 → 12
 * - dream：含 vector 检索 → 8
 *
 * `default` 留给未知 intent / 全站老路径，沿用 HOURLY_LIMIT。
 */
export type RateLimitIntent =
  | "chat"
  | "divination"
  | "bazi"
  | "meihua"
  | "dream"
  | "default";

export const INTENT_LIMITS: Record<RateLimitIntent, number> = {
  chat: 30,
  divination: 12,
  bazi: 8,
  meihua: 8,
  dream: 8,
  default: HOURLY_LIMIT,
};

export function limitForIntent(intent?: RateLimitIntent | string | null): number {
  if (!intent) return HOURLY_LIMIT;
  if (intent in INTENT_LIMITS) {
    return INTENT_LIMITS[intent as RateLimitIntent];
  }
  return HOURLY_LIMIT;
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  intent?: RateLimitIntent;
}

/** 纯函数评估：给定使用量和上限，输出限流决策 */
export function evaluateLimit(used: number, limit: number = HOURLY_LIMIT): RateLimitResult {
  const safeUsed = Math.max(0, Math.floor(used));
  return {
    allowed: safeUsed < limit,
    used: safeUsed,
    remaining: Math.max(0, limit - safeUsed),
    limit,
  };
}

export interface CountUserMessagesDeps {
  /**
   * 返回某 userId 在 sinceIso 之后的"用户角色"消息数；
   * intent 给定时只统计该 intent 的消息（messages.intent 列）。
   * 失败时抛错，由调用方决定 fail-open 还是 fail-closed。
   */
  countUserMessages(
    userId: string,
    sinceIso: string,
    intent?: RateLimitIntent,
  ): Promise<number>;
}

export async function isWithinLimit(
  userId: string,
  deps: CountUserMessagesDeps,
  options: { now?: Date; limit?: number; intent?: RateLimitIntent } = {},
): Promise<RateLimitResult> {
  const now = options.now ?? new Date();
  const intent = options.intent;
  const limit = options.limit ?? limitForIntent(intent);
  const sinceIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    const used = await deps.countUserMessages(userId, sinceIso, intent);
    return { ...evaluateLimit(used, limit), intent };
  } catch (err) {
    console.error("rate-limit countUserMessages 查询失败", err);
    // fail-open: 失败时放行，避免因 DB 抖动封死流量；调用方做次级监控
    return {
      allowed: true,
      used: 0,
      remaining: limit,
      limit,
      intent,
    };
  }
}
