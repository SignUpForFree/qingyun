import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { ensureUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { profiles, fortunesDaily } from "@/lib/db/schema";
import { fetchTodayFortune, NoDefaultProfileError } from "@/lib/fortune/fetch-today";
import { buildFortuneReadingPrompt } from "@/lib/ai/prompts/fortune-reading";
import { chat } from "@/lib/ai/client";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { buildChartV2 } from "@/lib/bazi/chart";
import { getDayPillar } from "@/lib/bazi/today";
import { checkRateLimit } from "@/lib/ai/check-rate-limit";

/**
 * POST /api/fortune/today/regenerate — 异步把 fallback reading 升级到 AI 个性化版
 *
 * 详见 docs/superpowers/specs/2026-05-04-fortune-reading-ai-mcp.md §3
 *
 * Body：{ date?: string YYYY-MM-DD }（缺省 = 今天）
 *
 * 流程：
 *   1. ensureUserId + 拿默认 profile
 *   2. fetchTodayFortune 拿当日完整数据（含 fallback reading + 各项分数 + attrs）
 *   3. 已是 ai 版 → 直接返回 { regenerated: false, reason: "already_ai" }
 *   4. 限流（与 chat 共享 30/h，避免被刷）
 *   5. 调 AI（thinking: disabled，60-80 字 × 7 段 + 收尾，prompt 已塞好结构化数据）
 *   6. AI 失败 / 输出格式不像分段 → 不更新 db，返回 { regenerated: false, error }
 *   7. AI 成功 → sanitize + UPDATE fortunes_daily reading + reading_source=ai
 *   8. 返回 { regenerated: true, reading }
 *
 * runtime=nodejs：依赖 better-sqlite3 + chat() 走 fetch（默认 nodejs runtime）。
 *
 * 客户端入口：components/fortune/ReadingAutoRegen.tsx
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  // 限流：与 chat 共享 hour 桶（30/h），避免被刷出 AI 调用洪峰
  const limit = await checkRateLimit(userId, "chat");
  if (!limit.allowed) {
    return NextResponse.json(
      { regenerated: false, reason: "rate_limited" },
      { status: 429 },
    );
  }

  let fortune;
  try {
    fortune = fetchTodayFortune({ userId, date: parsed.data.date });
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

  // 取 profile 拿日主 / 用神，让 AI 解读结合八字
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
  } catch (e) {
    // 排盘失败不致命，AI 仍能用 score + attrs 生成 reading
    if (process.env.NODE_ENV !== "production") {
      console.warn("[regenerate] buildChartV2 失败，继续无日主排盘", e);
    }
  }

  const today = getDayPillar(new Date(`${fortune.date}T12:00:00+08:00`));
  const prompt = buildFortuneReadingPrompt({
    date: fortune.date,
    dayPillar: { gan: today.gan, zhi: today.zhi },
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
      // 7 段 × 60-80 字 = ~500 字总输出，AI 只做包装不需要推理
      thinking: "disabled",
      meta: { conversationId: "fortune-reading", userId },
    });
    aiText = result.text;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[regenerate] AI chat 失败", e);
    }
    return NextResponse.json(
      { regenerated: false, reason: "ai_failed" },
      { status: 200 },
    );
  }

  const sanitized = sanitizeAiOutput(aiText, "core");
  const cleaned = sanitized.cleaned.trim();

  // 校验 AI 输出像 7 段格式（含 5+ 个【维度 NN】片段才算合格）
  // FortuneReadingsBlock 的 parseReadingSections 按这个 pattern 切，不合格会显示空文案
  const sectionMatches = cleaned.match(/【[爱情|财富|事业|学习|健康|人际|心情]+\s+\d+】/g) ?? [];
  if (sectionMatches.length < 5) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[regenerate] AI 输出格式不符（仅 " + sectionMatches.length + " 段），保留 fallback");
    }
    return NextResponse.json(
      { regenerated: false, reason: "ai_format_invalid" },
      { status: 200 },
    );
  }

  try {
    db.update(fortunesDaily)
      .set({
        reading: cleaned,
        reading_source: "ai",
        generated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(fortunesDaily.profile_id, fortune.profileId),
          eq(fortunesDaily.date, fortune.date),
        ),
      )
      .run();
  } catch (e) {
    console.error("[regenerate] update fortunes_daily 失败", e);
    return NextResponse.json(
      { regenerated: false, reason: "db_update_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    regenerated: true,
    reading: cleaned,
    sanitized: {
      hitCount: sanitized.hitCount,
      hitWords: sanitized.hitWords,
    },
  });
}
