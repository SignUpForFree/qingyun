/**
 * KVStore 滑窗限流 — 配合 InProcessKVStore / Redis 都能跑
 *
 * 思路：每次调用 `consumeRateLimit` 在 `rate:{userId}:{intent}:{hourBucket}`
 * 上 incr 1，TTL 1h+10s。判断当前桶值是否超 limit。
 *
 * 与 lib/ai/check-rate-limit.ts（基于 SQLite messages 表 count）共存：
 *   - 旧路径仍然有效（messages 表是真实落库后的统计）
 *   - 新路径（本文件）适合 Redis 上线后做"全站统一窗口"，不依赖 messages 落库时序
 *
 * 详见 docs/superpowers/specs/2026-05-06-launch-readiness.md。
 */
import { kv } from "@/lib/cache";
import {
  evaluateLimit,
  limitForIntent,
  type RateLimitIntent,
  type RateLimitResult,
} from "./rate-limit";

const HOUR_MS = 60 * 60 * 1000;

function bucketKey(userId: string, intent: RateLimitIntent | undefined, now: number): string {
  const i = intent ?? "default";
  const hour = Math.floor(now / HOUR_MS);
  return `qy:rl:${i}:${userId}:${hour}`;
}

/**
 * 读取当前小时桶的使用量；不写入。
 */
export async function peekRateLimit(
  userId: string,
  intent?: RateLimitIntent,
  options: { now?: Date; limit?: number } = {},
): Promise<RateLimitResult> {
  const nowMs = (options.now ?? new Date()).getTime();
  const limit = options.limit ?? limitForIntent(intent);
  const used = ((await kv.get<number>(bucketKey(userId, intent, nowMs))) ?? 0) | 0;
  return { ...evaluateLimit(used, limit), intent };
}

/**
 * 原子消费一次配额：incr → 判断是否超限。
 *
 * 行为：
 *   - 即便 allowed=false，也已 incr 过；调用方需要"超限不重试"否则桶仍会增长
 *   - TTL 65 分钟（windows 边界附近多保留一点，避免漏算）
 *   - KV 失败时 fail-open（return allowed=true, used=0）
 */
export async function consumeRateLimit(
  userId: string,
  intent?: RateLimitIntent,
  options: { now?: Date; limit?: number } = {},
): Promise<RateLimitResult> {
  const nowMs = (options.now ?? new Date()).getTime();
  const limit = options.limit ?? limitForIntent(intent);
  const key = bucketKey(userId, intent, nowMs);
  try {
    const used = await kv.incr(key);
    if (used === 1) {
      // 第一次 incr 时设置 TTL；KV.incr 不自带 TTL
      await kv.expire(key, 65 * 60);
    }
    return { ...evaluateLimit(used, limit), intent };
  } catch (err) {
    console.error("[rate-limit-kv] consume failed", err);
    return { allowed: true, used: 0, remaining: limit, limit, intent };
  }
}

/** 测试辅助：清空本进程 InProcessKVStore（仅 dev / 测试调用） */
export async function _resetForTest(): Promise<void> {
  // 走全局 kv，调用方可在测试 setup 里 import { kv } 后 cast 调 reset
  type WithReset = { reset?: () => void };
  (kv as unknown as WithReset).reset?.();
}
