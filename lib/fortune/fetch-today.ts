import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesDaily, type Profile } from "@/lib/db/schema";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDaily7, type DimensionScores7 } from "./daily-7dim";
import { computeAttributes, type Attributes } from "./attributes";
import { pickOneLiner } from "./one-liner";
import { buildReadingFallback } from "./reading-fallback";
import { computeDailyScores } from "./scorer";
import { parsePillarsCache, serializePillars } from "@/lib/profile/bazi-pillars";

/**
 * 共享版 today fortune fetch (M4.4)
 *
 * 给 RSC（app/page.tsx）和 /api/fortune/today route 共用。同步 better-sqlite3，
 * 命中 fortunes_daily 缓存直接返回，未命中则 buildChartV2 + 写缓存。
 */

export interface DailyFortuneResult {
  cached: boolean;
  date: string;
  overall: number;
  scores: DimensionScores7;
  attributes: Attributes;
  oneLiner: string | null;
  reading: string;
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
  let pillars = parsePillarsCache(profile.bazi_pillars);

  const chartV2 = buildChartV2(
    {
      birthTime: new Date(
        `${profile.birth_date}T${(profile.birth_time || "12:00").slice(0, 5)}:00+08:00`,
      ),
      longitude: 121.47,
      latitude: 31.23,
      gender: (profile.gender ?? "male") as "male" | "female",
      calendarType: profile.birth_calendar,
    },
    { centerYear: new Date().getUTCFullYear() },
  );

  if (!pillars) {
    pillars = { pillars: chartV2.pillars, solarTrueTime: chartV2.solarTrueTime };
    try {
      db.update(profiles)
        .set({
          bazi_pillars: serializePillars(pillars),
          updated_at: new Date().toISOString(),
        })
        .where(eq(profiles.id, profile.id))
        .run();
    } catch (e) {
      console.error("写 bazi_pillars 缓存失败", e);
    }
  }

  const daily7 = computeDaily7({
    chart: {
      dayMaster: chartV2.dayMaster,
      fiveElements: chartV2.fiveElements,
    },
    day: today,
  });
  const attributes = computeAttributes(today);
  const dailyV1 = computeDailyScores(
    {
      dayMaster: chartV2.dayMaster,
      fiveElements: chartV2.fiveElements,
    },
    today,
  );
  const oneLiner = pickOneLiner(dailyV1);
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
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: [fortunesDaily.profile_id, fortunesDaily.date],
        set: {
          overall: daily7.overall,
          scores: JSON.stringify(daily7.scores),
          one_liner: oneLiner,
          attributes: JSON.stringify(attributes),
          reading,
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
    profileId: profile.id,
  };
}
