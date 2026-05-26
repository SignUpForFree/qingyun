import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesDaily, type Profile } from "@/lib/db/schema";
import { getDayPillar } from "@/lib/bazi/today";
import { getChartV2ForProfile } from "./chart-from-profile";
import { computeDaily7, type DimensionScores7 } from "./daily-7dim";
import { computeAttributes, type Attributes } from "./attributes";
import { pickOneLiner7 } from "./one-liner";
import { buildReadingFallback } from "./reading-fallback";
/**
 * 共享版 today fortune fetch (M4.4)
 *
 * 给 RSC（app/page.tsx）和 /api/fortune/today route 共用。同步 better-sqlite3，
 * 命中 fortunes_daily 缓存直接返回，未命中则 buildChartV2 + 写缓存。
 */

/**
 * reading 来源（参 docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md §3）
 *   "fallback" — 本地模板池兜底（lib/fortune/reading-fallback.ts，21 选 1）
 *   "ai"       — DeepSeek v4 Pro 生成（lib/ai/prompts/fortune-reading.ts）
 * 客户端 ReadingAutoRegen 检测 != "ai" 时 once-fire 触发 /api/fortune/today/regenerate
 */
export type ReadingSource = "fallback" | "ai";

export interface DailyFortuneResult {
  cached: boolean;
  date: string;
  overall: number;
  scores: DimensionScores7;
  attributes: Attributes;
  oneLiner: string | null;
  reading: string;
  readingSource: ReadingSource;
  profileId: string;
}

export class NoDefaultProfileError extends Error {
  constructor() {
    super("no_default_profile");
    this.name = "NoDefaultProfileError";
  }
}

export interface FetchTodayArgs {
  userId: string;
  date?: string;
}

export function fetchTodayFortune(args: FetchTodayArgs): DailyFortuneResult {
  const today = getDayPillar(
    args.date ? new Date(`${args.date}T12:00:00+08:00`) : undefined,
  );
  const db = getDb();

  const [defaultProfile] = db
    .select()
    .from(profiles)
    .where(and(eq(profiles.user_id, args.userId), eq(profiles.is_default, true)))
    .orderBy(asc(profiles.created_at))
    .limit(1)
    .all();

  if (!defaultProfile) throw new NoDefaultProfileError();

  // 缓存命中
  const [cached] = db
    .select()
    .from(fortunesDaily)
    .where(
      and(
        eq(fortunesDaily.profile_id, defaultProfile.id),
        eq(fortunesDaily.date, today.date),
      ),
    )
    .limit(1)
    .all();

  if (cached) {
    return {
      cached: true,
      date: cached.date,
      overall: cached.overall,
      scores: JSON.parse(cached.scores) as DimensionScores7,
      attributes: JSON.parse(cached.attributes) as Attributes,
      oneLiner: cached.one_liner,
      reading: cached.reading,
      readingSource: (cached.reading_source as ReadingSource) ?? "fallback",
      profileId: defaultProfile.id,
    };
  }

  return computeAndCacheFortune(defaultProfile, today);
}

function computeAndCacheFortune(
  profile: Profile,
  today: ReturnType<typeof getDayPillar>,
): DailyFortuneResult {
  const db = getDb();
  const chartV2 = getChartV2ForProfile(profile);

  const daily7 = computeDaily7({
    chart: chartV2,
    day: today,
    gender: (profile.gender ?? "other") as "male" | "female" | undefined,
  });
  const attributes = computeAttributes(today, chartV2);
  const oneLiner = pickOneLiner7(daily7.scores, today.date);
  const reading = buildReadingFallback(today.date, daily7.scores);

  try {
    db.insert(fortunesDaily)
      .values({
        profile_id: profile.id,
        date: today.date,
        overall: daily7.overall,
        scores: JSON.stringify(daily7.scores),
        one_liner: oneLiner,
        attributes: JSON.stringify(attributes),
        reading,
        reading_source: "fallback",
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: [fortunesDaily.profile_id, fortunesDaily.date],
        set: {
          overall: daily7.overall,
          scores: JSON.stringify(daily7.scores),
          one_liner: oneLiner,
          attributes: JSON.stringify(attributes),
          // 注意：reading + reading_source **不在 conflict update 集合里**
          // 因为如果之前已是 ai 版，不要被这次 fallback 重算覆盖回 fallback
          generated_at: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  } catch (e) {
    console.error("upsert fortunes_daily 失败", e);
  }

  return {
    cached: false,
    date: today.date,
    overall: daily7.overall,
    scores: daily7.scores,
    attributes,
    oneLiner,
    reading,
    readingSource: "fallback",
    profileId: profile.id,
  };
}
