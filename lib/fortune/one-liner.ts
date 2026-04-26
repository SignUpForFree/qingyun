import type { DailyScores } from "./scorer";

/**
 * 静态 one-liner 兜底（DEEPSEEK_API_KEY 没填时仍能给出结构化文案）
 *
 * P2 D5 接 prompts 表 + DeepSeek 后由 fortune.daily prompt 替换为 AI 解读
 */
const POOLS: Record<"high" | "mid" | "low", string[]> = {
  high: [
    "今天像被悄悄祝福了一下，节奏跟得上的话，事就顺。",
    "晨起的光是软的，做事别赶，自然就成。",
    "心里一直惦记的小事，今天试着推一下。",
    "今天适合敞开聊一聊，别憋着。",
  ],
  mid: [
    "不那么顺也不那么糟，把要紧的先做完。",
    "今天像泡了一壶不浓不淡的茶，慢慢喝。",
    "节奏可以慢一点，不要逼自己。",
    "复杂的事先不下结论，等等再说。",
  ],
  low: [
    "今天宜静坐，不必勉强自己。",
    "节奏慢下来，少安排，多留白。",
    "心里有些闷的话，先关一会儿门，喝点热的。",
    "适合写写日记，别急着回复别人。",
  ],
};

export function pickOneLiner(scores: DailyScores): string {
  const { overall, date } = scores;
  const tier: "high" | "mid" | "low" = overall >= 80 ? "high" : overall >= 65 ? "mid" : "low";
  const pool = POOLS[tier];
  // 用 date 做稳定 seed —— 同一天同一档案返回同一句
  const seed = hashString(date + scores.meta.dayPillar.gan + scores.meta.dayPillar.zhi);
  return pool[seed % pool.length];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
