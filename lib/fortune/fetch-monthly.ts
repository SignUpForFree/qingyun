import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesMonthly, type Profile } from "@/lib/db/schema";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDaily7, type DimensionScores7 } from "./daily-7dim";
import { computeAttributes, type Attributes } from "./attributes";
import { pickOneLiner7 } from "./one-liner";
import { buildReadingFallback } from "./reading-fallback";
import { NoDefaultProfileError, type ReadingSource } from "./fetch-today";
import { getChartV2ForProfile } from "./chart-from-profile";
import { monthKeyFromIso, datesInCalendarMonth } from "./period-utils";
import { averageDimensionScores7, weightedOverallFromDim7 } from "./aggregate-dim7";

export interface MonthlyFortuneResult {
  cached: boolean;
  /** YYYY-MM */
  month: string;
  anchorDate: string;
  monthHint: string;
  overall: number;
  scores: DimensionScores7;
  attributes: Attributes;
  oneLiner: string | null;
  reading: string;
  readingSource: ReadingSource;
  profileId: string;
}

export function fetchMonthlyFortune(args: {
  userId: string;
  anchorDate: string;
}): MonthlyFortuneResult {
  const month = monthKeyFromIso(args.anchorDate);
  const db = getDb();

  const [defaultProfile] = db
    .select()
    .from(profiles)
    .where(and(eq(profiles.user_id, args.userId), eq(profiles.is_default, true)))
    .orderBy(asc(profiles.created_at))
    .limit(1)
    .all();

  if (!defaultProfile) throw new NoDefaultProfileError();

  const chartV2 = getChartV2ForProfile(defaultProfile);

  const [cached] = db
    .select()
    .from(fortunesMonthly)
    .where(
      and(
        eq(fortunesMonthly.profile_id, defaultProfile.id),
        eq(fortunesMonthly.month, month),
      ),
    )
    .limit(1)
    .all();

  if (cached?.overall != null && cached.scores && cached.reading) {
    const dates = datesInCalendarMonth(month);
    const midIso = dates[Math.floor((dates.length - 1) / 2)] ?? dates[0]!;
    const attributes = computeAttributes(
      getDayPillar(new Date(`${midIso}T12:00:00+08:00`)),
      chartV2,
    );
    const [y, m] = month.split("-").map(Number);
    return {
      cached: true,
      month,
      anchorDate: args.anchorDate,
      monthHint: `${y}年${m}月`,
      overall: cached.overall,
      scores: JSON.parse(cached.scores) as DimensionScores7,
      attributes,
      oneLiner: cached.one_liner,
      reading: cached.reading,
      readingSource: (cached.reading_source as ReadingSource) ?? "fallback",
      profileId: defaultProfile.id,
    };
  }

  return computeAndCacheMonthly(defaultProfile, chartV2, month, args.anchorDate);
}

function computeAndCacheMonthly(
  profile: Profile,
  chartV2: ReturnType<typeof getChartV2ForProfile>,
  month: string,
  anchorDate: string,
): MonthlyFortuneResult {
  const db = getDb();
  const dates = datesInCalendarMonth(month);
  const dailyScores: DimensionScores7[] = dates.map((iso) => {
    const day = getDayPillar(new Date(`${iso}T12:00:00+08:00`));
    return computeDaily7({ chart: chartV2, day, gender: (profile.gender ?? "other") as "male" | "female" | undefined }).scores;
  });

  const scores = averageDimensionScores7(dailyScores);
  const overall = weightedOverallFromDim7(scores);

  const midIso = dates[Math.floor((dates.length - 1) / 2)] ?? dates[0];
  const midDay = getDayPillar(new Date(`${midIso}T12:00:00+08:00`));
  const attributes: Attributes = computeAttributes(midDay, chartV2);
  const oneLiner = pickOneLiner7(scores, midDay.date);

  const reading = buildReadingFallback(`${month}|month`, scores);

  const [y, m] = month.split("-").map(Number);
  const monthHint = `${y}年${m}月`;

  try {
    db.insert(fortunesMonthly)
      .values({
        profile_id: profile.id,
        month,
        overall,
        scores: JSON.stringify(scores),
        one_liner: oneLiner,
        reading,
        reading_source: "fallback",
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: [fortunesMonthly.profile_id, fortunesMonthly.month],
        set: {
          overall,
          scores: JSON.stringify(scores),
          one_liner: oneLiner,
          // reading + reading_source 不在 update 集合，已是 ai 不要被 fallback 覆盖
          generated_at: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  } catch (e) {
    console.error("upsert fortunes_monthly 失败", e);
  }

  return {
    cached: false,
    month,
    anchorDate,
    monthHint,
    overall,
    scores,
    attributes,
    oneLiner,
    reading,
    readingSource: "fallback",
    profileId: profile.id,
  };
}