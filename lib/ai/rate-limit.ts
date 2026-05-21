/**
 * 用户级限流（按 intent 配置时间窗 + 次数上限）
 *
 * 统计 conversations.user_id + messages.role='user' + messages.intent 在窗口内的条数。
 */

export const HOURLY_LIMIT = Number(process.env.RATE_LIMIT_PER_USER_HOURLY ?? 30);
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** 开发/联调用：不限次数 */
const UNLIMITED_LIMIT = 999_999;

/** RATE_LIMIT_DISABLED=1|true|yes 时全 intent 放行 */
export function isRateLimitDisabled(): boolean {
  const v = process.env.RATE_LIMIT_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type RateLimitIntent =
  | "chat"
  | "divination"
  | "bazi"
  | "meihua"
  | "dream"
  | "default";

export interface IntentRateConfig {
  limit: number;
  windowMs: number;
}

function divinationRateConfig(): IntentRateConfig {
  if (isRateLimitDisabled()) {
    return { limit: UNLIMITED_LIMIT, windowMs: MINUTE_MS };
  }
  const perMinute = process.env.RATE_LIMIT_DIVINATION_PER_MINUTE?.trim();
  if (perMinute) {
    return { limit: Math.max(1, Number(perMinute) || 2), windowMs: MINUTE_MS };
  }
  /** 开发环境默认不限次数，便于动效/流程联调 */
  if (process.env.NODE_ENV !== "production") {
    return { limit: UNLIMITED_LIMIT, windowMs: MINUTE_MS };
  }
  return { limit: 12, windowMs: HOUR_MS };
}

const BASE_INTENT_CONFIG: Record<RateLimitIntent, IntentRateConfig> = {
  chat: { limit: 30, windowMs: HOUR_MS },
  divination: { limit: 12, windowMs: HOUR_MS },
  bazi: { limit: 8, windowMs: HOUR_MS },
  meihua: { limit: 8, windowMs: HOUR_MS },
  dream: { limit: 8, windowMs: HOUR_MS },
  default: { limit: HOURLY_LIMIT, windowMs: HOUR_MS },
};

export function rateConfigForIntent(
  intent?: RateLimitIntent | string | null,
): IntentRateConfig {
  if (intent === "divination") return divinationRateConfig();
  if (intent && intent in BASE_INTENT_CONFIG) {
    return BASE_INTENT_CONFIG[intent as RateLimitIntent];
  }
  return BASE_INTENT_CONFIG.default;
}

/** @deprecated 用 rateConfigForIntent；保留兼容 */
export const INTENT_LIMITS: Record<RateLimitIntent, number> = {
  chat: BASE_INTENT_CONFIG.chat.limit,
  divination: divinationRateConfig().limit,
  bazi: BASE_INTENT_CONFIG.bazi.limit,
  meihua: BASE_INTENT_CONFIG.meihua.limit,
  dream: BASE_INTENT_CONFIG.dream.limit,
  default: HOURLY_LIMIT,
};

export function limitForIntent(intent?: RateLimitIntent | string | null): number {
  return rateConfigForIntent(intent).limit;
}

export function windowMsForIntent(intent?: RateLimitIntent | string | null): number {
  return rateConfigForIntent(intent).windowMs;
}

/** 429 友好文案（按窗口显示「每分钟」或「每小时」） */
export function formatRateLimitDeniedMessage(
  intent: RateLimitIntent,
  result: RateLimitResult,
  label: string,
): string {
  const windowMs = windowMsForIntent(intent);
  const unit = windowMs <= MINUTE_MS ? "每分钟" : "每小时";
  return `${unit}${label}上限 ${result.limit} 次，请稍后再试（已发 ${result.used}）`;
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
  const cfg = rateConfigForIntent(intent);
  const limit = options.limit ?? cfg.limit;
  const sinceIso = new Date(now.getTime() - cfg.windowMs).toISOString();

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
