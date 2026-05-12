import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesMonthly } from "@/lib/db/schema";
import { fetchMonthlyFortune } from "@/lib/fortune/fetch-monthly";
import { NoDefaultProfileError } from "@/lib/fortune/fetch-today";
import { buildPeriodReadingPrompt } from "@/lib/ai/prompts/fortune-reading";
import { chat } from "@/lib/ai/client";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { buildChartV2 } from "@/lib/bazi/chart";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";

/**
 * POST /api/fortune/monthly/regenerate — 把 monthly fallback reading 升级到 AI 个性化版
 *
 * 与 weekly 同模式，作用于 fortunes_monthly。
 * Body：{ anchorDate: YYYY-MM-DD }
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const userId = await ensureUserId();

  const limit = await checkRateLimit(userId, "chat");
  if (!limit.allowed) {
    return NextResponse.json(
      { regenerated: false, reason: "rate_limited" },
      { status: 429 },
    );
  }

  let fortune;
  try {
    fortune = fetchMonthlyFortune({ userId, anchorDate: parsed.data.anchorDate });
  } catch (e) {
    if (e instanceof NoDefaultProfileError) {
      return NextResponse.json(
        { regenerated: false, reason: "no_profile" },
        { status: 404 },
      );
    }
    throw e;
  }

  if (fortune.readingSource === "ai") {
    return NextResponse.json({
      regenerated: false,
      reason: "already_ai",
      reading: fortune.reading,
    });
  }

  const db = getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, fortune.profileId), eq(profiles.user_id, userId)))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { regenerated: false, reason: "no_profile" },
      { status: 404 },
    );
  }

  let dayMaster: string | undefined;
  let yongShen: string | undefined;
  try {
    const chart = buildChartV2(
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
    dayMaster = chart.dayMaster;
    yongShen = chart.yongShen?.yongShen;
  } catch {
    /* 命盘失败不致命 */
  }

  const prompt = buildPeriodReadingPrompt({
    period: "month",
    anchorDate: `${fortune.month}-01`,
    rangeHint: fortune.monthHint,
    scores: fortune.scores,
    attributes: fortune.attributes,
    dayMaster,
    yongShen,
    oneLiner: fortune.oneLiner ?? undefined,
  });

  let aiText: string;
  try {
    const result = await chat({
      systemPrompt: prompt.systemPrompt,
      messages: [{ role: "user", content: prompt.userPrompt }],
      thinking: "disabled",
      meta: { conversationId: "fortune-reading-monthly", userId },
    });
    aiText = result.text;
  } catch {
    return NextResponse.json(
      { regenerated: false, reason: "ai_failed" },
      { status: 200 },
    );
  }

  const sanitized = sanitizeAiOutput(aiText, "core");
  const cleaned = sanitized.cleaned.trim();

  const sectionMatches =
    cleaned.match(/【[爱情|财富|事业|学习|健康|人际|心情]+\s+\d+】/g) ?? [];
  if (sectionMatches.length < 5) {
    return NextResponse.json(
      { regenerated: false, reason: "ai_format_invalid" },
      { status: 200 },
    );
  }

  try {
    db.update(fortunesMonthly)
      .set({
        reading: cleaned,
        reading_source: "ai",
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(fortunesMonthly.profile_id, fortune.profileId),
          eq(fortunesMonthly.month, fortune.month),
        ),
      )
      .run();
  } catch (e) {
    console.error("[regenerate-monthly] update fortunes_monthly 失败", e);
    return NextResponse.json(
      { regenerated: false, reason: "db_update_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    regenerated: true,
    reading: cleaned,
  });
}
