import "server-only";
import { createAdmin } from "@/lib/supabase/admin";
import { buildChart } from "@/lib/bazi/chart";
import type { Database } from "@/types/database";
import type { Gender, CalendarType } from "@/types/domain";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * 确保 profile 对应的 bazi_charts 已写入
 *
 * - 已有 → 直接返回（idempotent）
 * - 缺字段 → 抛错（profile 必须含 birth_time / birth_longitude / gender）
 * - 否则用 buildChart 排盘后写入 bazi_charts
 *
 * 用 admin client 绕过 RLS（profile_id 关联校验已在调用方完成）
 */
export async function ensureBaziChart(profile: Profile): Promise<void> {
  const admin = createAdmin();

  const { data: existing } = await admin
    .from("bazi_charts")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (existing) return;

  if (!profile.birth_time) {
    throw new Error("ensureBaziChart: profile.birth_time 缺失");
  }
  if (profile.birth_longitude === null || profile.birth_longitude === undefined) {
    throw new Error("ensureBaziChart: profile.birth_longitude 缺失");
  }
  if (!profile.gender) {
    throw new Error("ensureBaziChart: profile.gender 缺失");
  }

  const chart = buildChart({
    birthTime: new Date(profile.birth_time),
    longitude: Number(profile.birth_longitude),
    latitude: Number(profile.birth_latitude ?? 0),
    gender: profile.gender as Gender,
    calendarType: (profile.calendar_type ?? "solar") as CalendarType,
  });

  // 占位 Database 类型尚未跑 supabase gen types，临时 cast 让 supabase-js 通过类型检查；
  // W2 用户跑 ./scripts/gen-types.sh 后这里自动恢复正确推导
  const insertRow = {
    profile_id: profile.id,
    pillars: chart.pillars,
    five_elements: chart.fiveElements,
    day_master: chart.dayMaster,
    ten_gods: chart.tenGods,
    favorable_gods: null,
    luck_pillars: chart.luckPillars,
    solar_true_time: chart.solarTrueTime,
    raw: { computedAt: new Date().toISOString(), libVersion: "lunar-javascript" },
  };
  const { error } = await admin.from("bazi_charts").insert(insertRow as never);

  if (error) {
    throw new Error(`ensureBaziChart 写入失败: ${error.message}`);
  }
}
