export const DAILY_DIMS = [
  "爱情",
  "财富",
  "事业",
  "学习",
  "健康",
  "人际",
  "心情",
] as const;

export type DailyDim = (typeof DAILY_DIMS)[number];

export function isDailyDim(s: string): s is DailyDim {
  return (DAILY_DIMS as readonly string[]).includes(s);
}
