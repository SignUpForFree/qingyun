import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { baziCharts, fortunes } from "@/lib/db/schema";
import { getDayPillar, type DayPillar } from "@/lib/bazi/today";
import { computeDailyScores } from "@/lib/fortune/scorer";
import { computeAttributes, type Attributes } from "@/lib/fortune/attributes";
import { pickOneLiner } from "@/lib/fortune/one-liner";
import { parseJson, serializeJson } from "@/lib/db/json";
import type { Wuxing } from "@/lib/bazi/stems-branches";

export interface FortunePayload {
  date: string;
  overall: number;
  scores: Record<string, number>;
  oneLiner: string | null;
  attributes: Partial<Attributes>;
  /** 是否当场计算的（vs 缓存命中） */
  computed: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s: string): boolean {
  return ISO_DATE_RE.test(s);
}

export function todayDateStr(): string {
  return getDayPillar().date;
}

/**
 * 读取指定日期的运势：缓存优先，命中即返回
 *
 * - 仅当 date 是『今天』且无缓存时，才会现场计算并写入缓存
 * - 历史日期无缓存 → 返回 null（我们不补历史运势）
 * - 未来日期 → 返回 null
 */
export async function loadFortuneByDate(
  profileId: string,
  date: string,
): Promise<FortunePayload | null> {
  if (!isValidDateStr(date)) return null;
  const today = todayDateStr();

  const db = getDb();
  const cached = await db
    .select()
    .from(fortunes)
    .where(eq(fortunes.profile_id, profileId))
    .limit(60);
  const hit = cached.find((f) => f.fortune_date === date);
  if (hit) return hydrate(hit, false);

  if (date !== today) return null;

  // 当场算
  const dayPillar: DayPillar = getDayPillar();
  const chartRow = await db
    .select()
    .from(baziCharts)
    .where(eq(baziCharts.profile_id, profileId))
    .limit(1);
  const chart = chartRow[0];
  if (!chart) return null;

  const fiveElements = parseJson<Record<Wuxing, number>>(chart.five_elements, {
    金: 0,
    木: 0,
    水: 0,
    火: 0,
    土: 0,
  });
  const scores = computeDailyScores(
    { dayMaster: chart.day_master, fiveElements },
    dayPillar,
  );
  const attributes = computeAttributes(dayPillar);
  const oneLiner = pickOneLiner(scores);

  const [inserted] = await db
    .insert(fortunes)
    .values({
      profile_id: profileId,
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
  if (!inserted) return null;

  return hydrate(inserted, true);
}

interface FortuneRow {
  fortune_date: string;
  score_overall: number | null;
  scores: string | null;
  one_liner: string | null;
  attributes: string | null;
}

function hydrate(row: FortuneRow, computed: boolean): FortunePayload {
  return {
    date: row.fortune_date,
    overall: row.score_overall ?? 0,
    scores: parseJson<Record<string, number>>(row.scores, {}),
    oneLiner: row.one_liner,
    attributes: parseJson<Partial<Attributes>>(row.attributes, {}),
    computed,
  };
}
