import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { baziCharts, type Profile } from "@/lib/db/schema";
import { buildChart } from "@/lib/bazi/chart";
import { serializeJson } from "@/lib/db/json";
import type { Gender, CalendarType } from "@/types/domain";

/**
 * 确保 profile 对应的 bazi_charts 已写入
 *
 * - 已有 → 直接返回（idempotent）
 * - 缺字段 → 抛错（profile 必须含 birth_time / birth_longitude / gender）
 * - 否则用 buildChart 排盘后写入 bazi_charts
 *
 * SQLite 把 jsonb 列存为 text，写入前 JSON.stringify。
 */
export async function ensureBaziChart(profile: Profile): Promise<void> {
  const db = getDb();

  const existing = await db
    .select({ id: baziCharts.id })
    .from(baziCharts)
    .where(eq(baziCharts.profile_id, profile.id))
    .limit(1);
  if (existing[0]) return;

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

  await db.insert(baziCharts).values({
    profile_id: profile.id,
    pillars: serializeJson(chart.pillars),
    five_elements: serializeJson(chart.fiveElements),
    day_master: chart.dayMaster,
    ten_gods: serializeJson(chart.tenGods),
    favorable_gods: null,
    luck_pillars: serializeJson(chart.luckPillars),
    solar_true_time: chart.solarTrueTime,
    raw: serializeJson({
      computedAt: new Date().toISOString(),
      libVersion: "lunar-javascript",
    }),
  });
}
