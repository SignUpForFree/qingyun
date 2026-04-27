export const DIVINATION_DIMS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

export type DivinationDim = (typeof DIVINATION_DIMS)[number];

export function isDivinationDim(s: string): s is DivinationDim {
  return (DIVINATION_DIMS as readonly string[]).includes(s);
}
