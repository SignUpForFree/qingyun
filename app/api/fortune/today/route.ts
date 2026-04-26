import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { fortunes, baziCharts } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/profile/current";
import { getDayPillar } from "@/lib/bazi/today";
import { computeDailyScores } from "@/lib/fortune/scorer";
import { computeAttributes } from "@/lib/fortune/attributes";
import { pickOneLiner } from "@/lib/fortune/one-liner";
import { parseJson, serializeJson } from "@/lib/db/json";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * GET /api/fortune/today — 当前用户当前档案的今日运势
 *
 * 流程：
 *   1. 取当前 profile + bazi_charts
 *   2. 算今日干支 dayPillar
 *   3. fortunes 表查 (profile_id, fortune_date) 命中 → 直接返回缓存
 *   4. miss → 跑 scorer + attributes + one-liner，落库后返回
 *
 * 没建档 → 200 { fortune: null }，前端引导 onboarding
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ fortune: null, reason: "no_profile" });
  }

  const db = getDb();

  const chartRow = await db
    .select()
    .from(baziCharts)
    .where(eq(baziCharts.profile_id, profile.id))
    .limit(1);
  const chart = chartRow[0];
  if (!chart) {
    return NextResponse.json({ fortune: null, reason: "no_bazi" });
  }

  const dayPillar = getDayPillar();

  // 缓存命中？
  const cached = await db
    .select()
    .from(fortunes)
    .where(and(eq(fortunes.profile_id, profile.id), eq(fortunes.fortune_date, dayPillar.date)))
    .limit(1);

  if (cached[0]) {
    return NextResponse.json({
      fortune: hydrate(cached[0]),
    });
  }

  // 计算
  const fiveElements = parseJson<Record<Wuxing, number>>(chart.five_elements, {
    金: 0,
    木: 0,
    水: 0,
    火: 0,
    土: 0,
  });
  const scores = computeDailyScores(
    {
      dayMaster: chart.day_master,
      fiveElements,
    },
    dayPillar,
  );
  const attributes = computeAttributes(dayPillar);
  const oneLiner = pickOneLiner(scores);

  // 落库
  const [inserted] = await db
    .insert(fortunes)
    .values({
      profile_id: profile.id,
      fortune_date: dayPillar.date,
      score_overall: scores.overall,
      scores: serializeJson(scores.scores),
      one_liner: oneLiner,
      readings: serializeJson({ meta: scores.meta }),
      attributes: serializeJson(attributes),
      model: "static-fallback",
      tokens_used: 0,
    })
    .returning();

  return NextResponse.json({
    fortune: hydrate(inserted ?? {
      id: "tmp",
      profile_id: profile.id,
      fortune_date: dayPillar.date,
      score_overall: scores.overall,
      scores: serializeJson(scores.scores),
      one_liner: oneLiner,
      readings: serializeJson({ meta: scores.meta }),
      attributes: serializeJson(attributes),
      model: "static-fallback",
      tokens_used: 0,
      created_at: new Date().toISOString(),
    }),
  });
}

interface FortuneRowLike {
  id: string;
  profile_id: string;
  fortune_date: string;
  score_overall: number | null;
  scores: string | null;
  one_liner: string | null;
  readings: string | null;
  attributes: string | null;
  model: string | null;
  tokens_used: number | null;
  created_at: string;
}

function hydrate(row: FortuneRowLike) {
  return {
    id: row.id,
    date: row.fortune_date,
    overall: row.score_overall,
    scores: parseJson(row.scores, {}),
    oneLiner: row.one_liner,
    readings: parseJson(row.readings, {}),
    attributes: parseJson(row.attributes, {}),
    model: row.model,
    tokensUsed: row.tokens_used,
  };
}
