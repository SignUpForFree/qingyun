import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, type Profile } from "@/lib/db/schema";
import { buildChartV2 } from "@/lib/bazi/chart";
import { parsePillarsCache, serializePillars } from "@/lib/profile/bazi-pillars";

/**
 * 默认档案命理盘（与 fetch-today 一致）+ 顺带写回 bazi_pillars 缓存。
 * 供日 / 周 / 月运势共用，避免三套 fetch 复制 buildChartV2。
 */
export function getChartV2ForProfile(profile: Profile): ReturnType<typeof buildChartV2> {
  const db = getDb();
  let pillars = parsePillarsCache(profile.bazi_pillars);

  const chartV2 = buildChartV2(
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

  if (!pillars) {
    pillars = { pillars: chartV2.pillars, solarTrueTime: chartV2.solarTrueTime };
    try {
      db.update(profiles)
        .set({
          bazi_pillars: serializePillars(pillars),
          updated_at: new Date().toISOString(),
        })
        .where(eq(profiles.id, profile.id))
        .run();
    } catch (e) {
      console.error("写 bazi_pillars 缓存失败", e);
    }
  }

  return chartV2;
}
