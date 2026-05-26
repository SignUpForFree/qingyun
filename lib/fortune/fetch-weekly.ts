import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesWeekly, type Profile } from "@/lib/db/schema";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDaily7, type DimensionScores7 } from "./daily-7dim";
import { computeAttributes, type Attributes } from "./attributes";
import { pickOneLiner7 } from "./one-liner";
import { buildReadingFallback } from "./reading-fallback";
import { NoDefaultProfileError, type ReadingSource } from "./fetch-today";
import { getChartV2ForProfile } from "./chart-from-profile";
import {
  mondayOfWeekContaining,
  datesInWeekFromMonday,
  addCalendarDaysIso,
  formatWeekRangeCn,
} from "./period-utils";
import { averageDimensionScores7, weightedOverallFromDim7 } from "./aggregate-dim7";

export interface WeeklyFortuneResult {
  cached: boolean;
  /** 该周周一 YYYY-MM-DD */
  weekStart: string;
  /** URL 锚点日 */
  anchorDate: string;
  rangeHint: string;
  overall: number;
  scores: DimensionScores7;
  attributes: Attributes;
  oneLiner: string | null;
  reading: string;
  readingSource: ReadingSource;
  profileId: string;
}

export function fetchWeeklyFortune(args: {
  userId: string;
  anchorDate: string;
}): WeeklyFortuneResult {
  const weekStart = mondayOfWeekContaining(args.anchorDate);
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
    .from(fortunesWeekly)
    .where(
      and(
        eq(fortunesWeekly.profile_id, defaultProfile.id),
        eq(fortunesWeekly.week_start, weekStart),
      ),
    )
    .limit(1)
    .all();

  if (cached?.overall != null && cached.scores && cached.reading) {
    const midIso = addCalendarDaysIso(weekStart, 3);
    const attributes = computeAttributes(
      getDayPillar(new Date(`${midIso}T12:00:00+08:00`)),
      chartV2,
    );
    return {
      cached: true,
      weekStart,
      anchorDate: args.anchorDate,
      rangeHint: formatWeekRangeCn(weekStart),
      overall: cached.overall,
      scores: JSON.parse(cached.scores) as DimensionScores7,
      attributes,
      oneLiner: cached.one_liner,
      reading: cached.reading,
      readingSource: (cached.reading_source as ReadingSource) ?? "fallback",
      profileId: defaultProfile.id,
    };
  }

  return computeAndCacheWeekly(defaultProfile, chartV2, weekStart, args.anchorDate);
}

function computeAndCacheWeekly(
  profile: Profile,
  chartV2: ReturnType<typeof getChartV2ForProfile>,
  weekStart: string,
  anchorDate: string,
): WeeklyFortuneResult {
  const db = getDb();
  const dates = datesInWeekFromMonday(weekStart);
  const dailyScores: DimensionScores7[] = dates.map((iso) => {
    const day = getDayPillar(new Date(`${iso}T12:00:00+08:00`));
    return computeDaily7({ chart: chartV2, day, gender: (profile.gender ?? "other") as "male" | "female" | undefined }).scores;
  });

  const scores = averageDimensionScores7(dailyScores);
  const overall = weightedOverallFromDim7(scores);

  const midIso = addCalendarDaysIso(weekStart, 3);
  const midDay = getDayPillar(new Date(`${midIso}T12:00:00+08:00`));
  const attributes: Attributes = computeAttributes(midDay, chartV2);
  const oneLiner = pickOneLiner7(scores, midDay.date);
  const reading = buildReadingFallback(`${weekStart}|week`, scores);

  try {
    db.insert(fortunesWeekly)
      .values({
        profile_id: profile.id,
        week_start: weekStart,
        overall,
        scores: JSON.stringify(scores),
        one_liner: oneLiner,
        reading,
        reading_source: "fallback",
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: [fortunesWeekly.profile_id, fortunesWeekly.week_start],
        set: {
          overall,
          scores: JSON.stringify(scores),
          one_liner: oneLiner,
          // reading + reading_source 不在 update 集合：已是 ai 不要被 fallback 覆盖
          generated_at: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  } catch (e) {
    console.error("upsert fortunes_weekly 失败", e);
  }

  return {
    cached: false,
    weekStart,
    anchorDate,
    rangeHint: formatWeekRangeCn(weekStart),
    overall,
    scores,
    attributes,
    oneLiner,
    reading,
    readingSource: "fallback",
    profileId: profile.id,
  };
}