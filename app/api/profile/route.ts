import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { ensureUserId } from "@/lib/auth/session";
import { setCurrentProfileId } from "@/lib/profile/current";
import { ensureBaziChart } from "@/lib/profile/ensure-bazi";
import { onboardingSchema } from "@/app/onboarding/_components/schema";

/**
 * POST /api/profile — 创建档案 + 自动触发八字排盘
 * GET  /api/profile — 读当前用户最近档案
 *
 * runtime=nodejs：依赖 better-sqlite3 + lunar-javascript（非 edge 兼容）
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "校验失败", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const userId = await ensureUserId();
  const f = parsed.data;
  const db = getDb();

  const [profile] = await db
    .insert(profiles)
    .values({
      user_id: userId,
      nickname: f.nickname,
      gender: f.gender,
      birth_time: f.birth.iso,
      calendar_type: f.birth.calendarType,
      birth_province: f.region.province,
      birth_city: f.region.city,
      birth_district: f.region.district ?? null,
      birth_longitude: f.region.longitude,
      birth_latitude: f.region.latitude,
      is_default: true,
    })
    .returning();

  if (!profile) {
    return NextResponse.json({ error: "档案保存失败" }, { status: 500 });
  }

  await setCurrentProfileId(profile.id);

  // 八字排盘失败不阻塞 onboarding
  try {
    await ensureBaziChart(profile);
  } catch (e) {
    console.error("ensureBaziChart 失败（onboarding 仍视为成功）", e);
  }

  return NextResponse.json({ profile });
}

export async function GET() {
  const userId = await ensureUserId();
  const db = getDb();
  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .orderBy(desc(profiles.is_default), desc(profiles.created_at))
    .limit(1);

  return NextResponse.json({ profile: result[0] ?? null });
}

// 让 and 在 import 里别报 unused（未来按需查询用）
void and;
