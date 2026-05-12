import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/auth/session";
import {
  fetchTodayFortune,
  NoDefaultProfileError,
} from "@/lib/fortune/fetch-today";

export const runtime = "nodejs";

/**
 * GET /api/fortune/today (M3.27 / M4.4 抽到 lib)
 *
 * 默认拿当前用户默认 profile，算今日 7 维度运势 + 8 lucky 属性 + one-liner +
 * reading（先用本地 fallback，M3.28 已有 AI prompt）；命中 fortunes_daily 缓存
 * 直接返回，否则 buildChartV2 + 写缓存。
 *
 * Query: ?date=YYYY-MM-DD（可选）
 *
 * 缺默认 profile → 404 + needs_profile，让前端走建档引导。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? undefined;

  const userId = await ensureUserId();

  try {
    const r = fetchTodayFortune({ userId, date });
    return NextResponse.json({
      cached: r.cached,
      date: r.date,
      overall: r.overall,
      scores: r.scores,
      attributes: r.attributes,
      one_liner: r.oneLiner,
      reading: r.reading,
      readingSource: r.readingSource,
    });
  } catch (e) {
    if (e instanceof NoDefaultProfileError) {
      return NextResponse.json(
        { error: "needs_profile", message: "请先建档" },
        { status: 404 },
      );
    }
    throw e;
  }
}
