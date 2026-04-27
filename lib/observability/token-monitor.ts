import "server-only";
import { and, desc, gte, lte, sum } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { messages } from "@/lib/db/schema";

/**
 * Token 预算监控 (M3.34, spec §5.9)
 *
 * 聚合 messages.tokens_used 给运维 dashboard / cron daily report 用。
 *
 * - 总额：since→until 区间内总 token
 * - 按 intent：chat / divination / bazi / meihua / dream 各自累计
 * - 按天：YYYY-MM-DD → 当日 token
 * - P95：单条消息 token 95 分位（识别异常长 prompt）
 *
 * 不查 conversations.user_id — 假设上层调用方已做 user 过滤；
 * 这一层是纯统计聚合。
 */

export interface TokenSummaryArgs {
  /** ISO timestamp 开始（含） */
  since: string;
  /** ISO timestamp 结束（含），默认 now */
  until?: string;
  /** 限定 user 时传入 — 与 conversations innerJoin */
  userId?: string;
}

export interface TokenIntentBucket {
  intent: string;
  totalTokens: number;
  messageCount: number;
}

export interface TokenDayBucket {
  date: string; // YYYY-MM-DD
  totalTokens: number;
  messageCount: number;
}

export interface TokenSummary {
  since: string;
  until: string;
  totalTokens: number;
  messageCount: number;
  byIntent: TokenIntentBucket[];
  byDay: TokenDayBucket[];
  /** 单条消息 95 分位 token 数（识别长 prompt 异常） */
  p95: number;
}

export async function getTokenUsageSummary(
  args: TokenSummaryArgs,
): Promise<TokenSummary> {
  const until = args.until ?? new Date().toISOString();
  const db = getDb();

  const rows = await db
    .select({
      intent: messages.intent,
      tokens_used: messages.tokens_used,
      created_at: messages.created_at,
    })
    .from(messages)
    .where(
      and(
        gte(messages.created_at, args.since),
        lte(messages.created_at, until),
      ),
    )
    .orderBy(desc(messages.created_at));

  return aggregateTokenRows(rows, args.since, until);
}

/** 纯函数版聚合 — 给单测用 */
export interface TokenRow {
  intent: string | null;
  tokens_used: number | null;
  created_at: string;
}

export function aggregateTokenRows(
  rows: ReadonlyArray<TokenRow>,
  since: string,
  until: string,
): TokenSummary {
  let totalTokens = 0;
  const intentMap = new Map<string, { totalTokens: number; messageCount: number }>();
  const dayMap = new Map<string, { totalTokens: number; messageCount: number }>();
  const tokenSamples: number[] = [];

  for (const row of rows) {
    const tokens = row.tokens_used ?? 0;
    totalTokens += tokens;
    if (tokens > 0) tokenSamples.push(tokens);

    const intent = row.intent ?? "unknown";
    const intentEntry = intentMap.get(intent) ?? { totalTokens: 0, messageCount: 0 };
    intentEntry.totalTokens += tokens;
    intentEntry.messageCount += 1;
    intentMap.set(intent, intentEntry);

    const day = row.created_at.slice(0, 10);
    const dayEntry = dayMap.get(day) ?? { totalTokens: 0, messageCount: 0 };
    dayEntry.totalTokens += tokens;
    dayEntry.messageCount += 1;
    dayMap.set(day, dayEntry);
  }

  const byIntent: TokenIntentBucket[] = [...intentMap.entries()]
    .map(([intent, v]) => ({ intent, ...v }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const byDay: TokenDayBucket[] = [...dayMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    since,
    until,
    totalTokens,
    messageCount: rows.length,
    byIntent,
    byDay,
    p95: percentile(tokenSamples, 0.95),
  };
}

/**
 * Drizzle SQL 简化总额（cron 高频调用时跳过 row scan）
 */
export async function getTotalTokensSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const r = await db
    .select({ total: sum(messages.tokens_used) })
    .from(messages)
    .where(gte(messages.created_at, sinceIso));
  return Number(r[0]?.total ?? 0);
}

/** P95（含线性插值，避免 small-N 突变） */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  if (p <= 0) return samples[0]!;
  if (p >= 1) return samples[samples.length - 1]!;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}
