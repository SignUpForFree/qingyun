import "server-only";
import type { Attributes } from "./attributes";
import type { DimensionScores7 } from "./daily-7dim";
import type { FortuneDetailScope } from "./fortune-scope";
export type { FortuneDetailScope } from "./fortune-scope";
export { parseFortuneScope } from "./fortune-scope";
import { fetchMonthlyFortune } from "./fetch-monthly";
import { fetchTodayFortune, type ReadingSource } from "./fetch-today";
import { fetchWeeklyFortune } from "./fetch-weekly";

export interface FortuneDetailPayload {
  scope: FortuneDetailScope;
  /** 地址栏日期 YYYY-MM-DD */
  anchorDate: string;
  /** 卡片下小字说明 */
  periodHint: string | null;
  cached: boolean;
  overall: number;
  scores: DimensionScores7;
  attributes: Attributes;
  oneLiner: string | null;
  reading: string;
  readingSource: ReadingSource;
  profileId: string;
  /**
   * 仅日运可能触发 ReadingAutoRegen；周/月为 null
   * 值 = 实际写入 fortunes_daily 的那一天（与锚点日相同）
   */
  readingRegenDate: string | null;
}

/**
 * 运势详情：日 / 周 / 月 分别走独立计算 + 独立缓存表。
 */
export function fetchFortuneDetail(args: {
  userId: string;
  date: string;
  scope: FortuneDetailScope;
}): FortuneDetailPayload {
  const { userId, date, scope } = args;

  if (scope === "week") {
    const w = fetchWeeklyFortune({ userId, anchorDate: date });
    return {
      scope: "week",
      anchorDate: w.anchorDate,
      periodHint: `本周 ${w.rangeHint}（7 日日运均值）`,
      cached: w.cached,
      overall: w.overall,
      scores: w.scores,
      attributes: w.attributes,
      oneLiner: w.oneLiner,
      reading: w.reading,
      readingSource: w.readingSource,
      profileId: w.profileId,
      readingRegenDate: w.anchorDate,
    };
  }

  if (scope === "month") {
    const m = fetchMonthlyFortune({ userId, anchorDate: date });
    return {
      scope: "month",
      anchorDate: m.anchorDate,
      periodHint: `${m.monthHint}（全月日日运均值）`,
      cached: m.cached,
      overall: m.overall,
      scores: m.scores,
      attributes: m.attributes,
      oneLiner: m.oneLiner,
      reading: m.reading,
      readingSource: m.readingSource,
      profileId: m.profileId,
      readingRegenDate: m.anchorDate,
    };
  }

  const d = fetchTodayFortune({ userId, date });
  return {
    scope: "day",
    anchorDate: d.date,
    periodHint: null,
    cached: d.cached,
    overall: d.overall,
    scores: d.scores,
    attributes: d.attributes,
    oneLiner: d.oneLiner,
    reading: d.reading,
    readingSource: d.readingSource,
    profileId: d.profileId,
    readingRegenDate: d.date,
  };
}
