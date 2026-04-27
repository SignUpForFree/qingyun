import { eq } from "drizzle-orm";
import { profiles, type Profile } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import type { BaziPillars } from "@/types/domain";
import { buildChart } from "@/lib/bazi/chart";

type Db = ReturnType<typeof getDb>;

/**
 * profile.bazi_pillars 缓存层 (M3.15)
 *
 * 职责：避开 lunar-javascript 重算（农历→公历→真太阳时→四柱），
 * 把不随流年变化的 pillars + solarTrueTime 缓存到 profiles.bazi_pillars 列。
 *
 * 神煞 / 大运 / 流年 / 用神 *不进缓存*：
 *   - 神煞 / 大运 / 用神 来自 pillars，规则匹配很轻量
 *   - 流年 取决于当前年份（每年变），缓存反而会过期
 */

export interface CachedPillars {
  pillars: BaziPillars;
  solarTrueTime: string; // ISO string，下游 buildChartV2 可不再重新算真太阳时
}

const SHANGHAI_LONGITUDE = 121.47;
const SHANGHAI_LATITUDE = 31.23;

/**
 * 把 profile.birth_date / birth_time 拼成带 UTC+8 偏移的 Date
 */
function parseBirthDateTime(date: string, time: string): Date {
  const t = time.length >= 5 ? time.slice(0, 5) : "12:00";
  const iso = `${date}T${t}:00+08:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date("1990-01-01T12:00:00+08:00");
  }
  return d;
}

/**
 * 从 profile 行直接 compute pillars（不查 / 不写缓存）
 * 内部用 lib/bazi/chart 的 buildChart 跑 lunar-javascript。
 */
export function computePillarsFromProfile(profile: Profile): CachedPillars {
  const birthTime = parseBirthDateTime(profile.birth_date, profile.birth_time);
  const computed = buildChart({
    birthTime,
    longitude: SHANGHAI_LONGITUDE,
    latitude: SHANGHAI_LATITUDE,
    gender: (profile.gender ?? "male") as "male" | "female",
    calendarType: profile.birth_calendar,
  });
  return {
    pillars: computed.pillars,
    solarTrueTime: computed.solarTrueTime,
  };
}

export function serializePillars(c: CachedPillars): string {
  return JSON.stringify(c);
}

/**
 * 解析 profile.bazi_pillars 字段；非法/空 → null
 */
export function parsePillarsCache(raw: string | null | undefined): CachedPillars | null {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (
      obj &&
      typeof obj === "object" &&
      "pillars" in obj &&
      "solarTrueTime" in obj &&
      isValidPillars((obj as { pillars: unknown }).pillars) &&
      typeof (obj as { solarTrueTime: unknown }).solarTrueTime === "string"
    ) {
      return obj as CachedPillars;
    }
    return null;
  } catch {
    return null;
  }
}

function isValidPillars(p: unknown): p is BaziPillars {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  for (const key of ["year", "month", "day", "hour"] as const) {
    const slot = o[key];
    if (
      !slot ||
      typeof slot !== "object" ||
      typeof (slot as { gan?: unknown }).gan !== "string" ||
      typeof (slot as { zhi?: unknown }).zhi !== "string"
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 首次调用：算 pillars → 写回 profile.bazi_pillars 列；
 * 二次调用：直接读缓存（不再 lunar-javascript）。
 *
 * 写缓存失败不影响业务路径（catch + console.error）。
 */
export function getOrComputeProfilePillars(db: Db, profile: Profile): CachedPillars {
  const cached = parsePillarsCache(profile.bazi_pillars);
  if (cached) return cached;

  const computed = computePillarsFromProfile(profile);
  try {
    db.update(profiles)
      .set({
        bazi_pillars: serializePillars(computed),
        updated_at: new Date().toISOString(),
      })
      .where(eq(profiles.id, profile.id))
      .run();
  } catch (e) {
    console.error("profile.bazi_pillars 写缓存失败", e);
  }
  return computed;
}
