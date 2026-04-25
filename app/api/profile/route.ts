import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setCurrentProfileId } from "@/lib/profile/current";
import { ensureBaziChart } from "@/lib/profile/ensure-bazi";
import { onboardingSchema } from "@/app/onboarding/_components/schema";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * POST /api/profile — 创建档案 + 自动触发八字排盘
 * GET  /api/profile — 读当前用户最近档案（onboarding 后跳回首页时用）
 *
 * runtime=nodejs：依赖 lunar-javascript（非 edge 兼容）
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

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const f = parsed.data;
  // 占位 Database 类型尚未跑 `supabase gen types`，supabase-js 推断为 never；
  // 这里给 insert 临时 cast，等用户填好 .env.local + 跑 ./scripts/gen-types.sh 后自动恢复正确类型
  const insertValues = {
    user_id: user.id,
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
  };
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert(insertValues as never)
    .select()
    .single();

  if (error || !profile) {
    console.error("profile insert 失败", error);
    return NextResponse.json({ error: "档案保存失败" }, { status: 500 });
  }

  // profile 同样因占位类型推断不全，按 ProfileRow 强转
  const typedProfile = profile as unknown as ProfileRow;

  await setCurrentProfileId(typedProfile.id);

  try {
    await ensureBaziChart(typedProfile);
  } catch (e) {
    console.error("ensureBaziChart 失败（onboarding 仍视为成功）", e);
  }

  return NextResponse.json({ profile: typedProfile });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ profile: null });

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ profile: data });
}
