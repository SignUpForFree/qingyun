import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesDaily } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDaily7 } from "@/lib/fortune/daily-7dim";
import { computeAttributes } from "@/lib/fortune/attributes";
import { pickOneLiner } from "@/lib/fortune/one-liner";
import { buildReadingFallback } from "@/lib/fortune/reading-fallback";
import { computeDailyScores } from "@/lib/fortune/scorer";
import { parsePillarsCache, serializePillars } from "@/lib/profile/bazi-pillars";

export const runtime = "nodejs";

/**
 * GET /api/fortune/today (M3.27)
 *
 * 默认拿当前用户的默认 profile，算今日 7 维度运势 + 8 lucky 属性 + one-liner +
 * reading（先用本地 fallback，M3.28 接入 AI prompt 后再走 AI）；
 * 命中 fortunes_daily 缓存（按 profile_id+date 唯一）则直接返回。
 *
 * Query string:
 *   ?date=YYYY-MM-DD（可选，默认今日 UTC+8）
 *
 * 缺默认 profile → 404 + needs_profile，让前端走建档引导。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedDate = url.searchParams.get("date") ?? undefined;
  const today = getDayPillar(requestedDate ? new Date(`${requestedDate}T12:00:00+08:00`) : undefined);

  const userId = await ensureUserId();
  const db = getDb();

  // 默认 profile（spec §2.2 A3 模式：每个用户至多 1 个 is_default）
  const [defaultProfile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.user_id, userId), eq(profiles.is_default, true)))
    .orderBy(asc(profiles.created_at))
    .limit(1);
  if (!defaultProfile) {
    return NextResponse.json(
      { error: "needs_profile", message: "请先建档" },
      { status: 404 },
    );
  }

  // 缓存命中
  const [cached] = await db
    .select()
    .from(fortunesDaily)
    .where(
      and(
        eq(fortunesDaily.profile_id, defaultProfile.id),
        eq(fortunesDaily.date, today.date),
      ),
    )
    .limit(1);
  if (cached) {
    return NextResponse.json({
      cached: true,
      date: cached.date,
      overall: cached.overall,
      scores: JSON.parse(cached.scores),
      attributes: JSON.parse(cached.attributes),
      one_liner: cached.one_liner,
      reading: cached.reading,
    });
  }

  // 计算 chart（缓存优先）
  let pillars = parsePillarsCache(defaultProfile.bazi_pillars);
  let chartV2;
  if (pillars) {
    chartV2 = buildChartV2(
      {
        birthTime: new Date(`${defaultProfile.birth_date}T${(defaultProfile.birth_time || "12:00").slice(0, 5)}:00+08:00`),
        longitude: 121.47,
        latitude: 31.23,
        gender: (defaultProfile.gender ?? "male") as "male" | "female",
        calendarType: defaultProfile.birth_calendar,
      },
      { centerYear: new Date().getUTCFullYear() },
    );
  } else {
    chartV2 = buildChartV2(
      {
        birthTime: new Date(`${defaultProfile.birth_date}T${(defaultProfile.birth_time || "12:00").slice(0, 5)}:00+08:00`),
        longitude: 121.47,
        latitude: 31.23,
        gender: (defaultProfile.gender ?? "male") as "male" | "female",
        calendarType: defaultProfile.birth_calendar,
      },
      { centerYear: new Date().getUTCFullYear() },
    );
    pillars = { pillars: chartV2.pillars, solarTrueTime: chartV2.solarTrueTime };
    // fire-and-forget 写缓存
    try {
      db.update(profiles)
        .set({
          bazi_pillars: serializePillars(pillars),
          updated_at: new Date().toISOString(),
        })
        .where(eq(profiles.id, defaultProfile.id))
        .run();
    } catch (e) {
      console.error("写 bazi_pillars 缓存失败", e);
    }
  }

  // 7 维度评分 + 8 属性 + one-liner（用 6 维度 scorer 拿 meta 给 one-liner）
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

  // upsert fortunes_daily
  try {
    db.insert(fortunesDaily)
      .values({
        profile_id: defaultProfile.id,
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

  return NextResponse.json({
    cached: false,
    date: today.date,
    overall: daily7.overall,
    scores: daily7.scores,
    attributes,
    one_liner: oneLiner,
    reading,
  });
}
