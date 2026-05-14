import type { DailyDim7, DimensionScores7 } from "./daily-7dim";

/**
 * 静态 oneLiner 兜底 — 综合各维度差异的叙事性一句话总评
 *
 * 根据当日7维度分数，找出亮点维度和短板维度，从对应池子中选一句
 * 综合性叙事文案。同一天同一档案返回同一句（用 date 做 stable seed）。
 *
 * AI regenerate 路径：ReadingAutoRegen 检测 readingSource !== "ai" 时触发升级。
 */

type Tier = "high" | "mid" | "low";

/** 按亮点维度（最高分维度）分类的叙事文案池 */
const BY_SPOTLIGHT: Record<DailyDim7, Record<Tier, string[]>> = {
  爱情: {
    high: [
      "今天心里有柔软的地方被轻轻碰到了，顺着感觉走比想太多管用。",
      "关系里的小事今天格外有分量，一句关心能走很远的路。",
      "感情上的暖意不是轰轰烈烈的那种，但像水一样能慢慢渗透。",
    ],
    mid: [
      "感情上的事不用急着想清楚，今天适合先把心思放在自己身上。",
      "关系里不用较真，点到为止反而舒服。",
      "心里若有点犹豫，先放着，过一天再看会更清楚。",
    ],
    low: [
      "今天心情容易因为别人的话起波澜，少回几条消息也无妨。",
      "感情线偏紧，先照顾好自己，别急着回应谁。",
      "人际关系上宜静不宜动，把力气留给让自己安心的事。",
    ],
  },
  财富: {
    high: [
      "财气不错的一天，手边的事顺手做完，小进项可能比你想象的多。",
      "今天适合复盘一下账目或留意小机会，但别铺太大。",
      "不是冲劲最强的一天，却是蓄力最好的时刻，好运会悄悄靠近。",
    ],
    mid: [
      "财气平稳，宜守不宜攻，把要做的预算列一列就好。",
      "今天的钱别花在情绪消费上，留给真正想做的事。",
      "不必追大项，小赚小花就是好事。",
    ],
    low: [
      "财气偏紧，重大支出宜缓，先把账算清楚。",
      "今天不太适合冲动下单或借出去，多留一分谨慎。",
      "宜静守本钱，不出手反而是好。",
    ],
  },
  事业: {
    high: [
      "工作上的反馈比预期好，节奏稳一点，能走得更远。",
      "适合推一件搁置的事，不求全功，往前一小步就行。",
      "不是所有进步都需要冲刺，今天稳扎稳打就够了。",
    ],
    mid: [
      "事业上没大风浪，把手头的小事做完整，比开新摊子重要。",
      "今天适合整理而非冲刺，桌面上清一清，心里也跟着清爽。",
      "节奏放半档，别给自己加难度。",
    ],
    low: [
      "工作上的事别硬扛，先做不要紧的让自己缓口气。",
      "容易卡在小细节上，简单的先放一放。",
      "宜守不宜攻，复杂的事留到明天再谈。",
    ],
  },
  学习: {
    high: [
      "脑子清亮，啃本难懂的书或学点新的都比平时上手快。",
      "今天适合做总结型任务，把脑里散的东西归归位。",
      "学新东西的入门门槛比平时低，趁势探一探。",
    ],
    mid: [
      "学习上不快不慢，回看旧笔记会有新感觉。",
      "今天适合做计划而非长时间死磕，三十分钟一段刚好。",
      "复杂的留到明天，先把简单的串起来。",
    ],
    low: [
      "脑子有点慢，少安排硬课，多让眼睛和手休息。",
      "学习节奏宜慢，做些抄写整理类的就好。",
      "复杂思考留到后天，今天用脑省一点。",
    ],
  },
  健康: {
    high: [
      "身体状态在线，做点想做又怕累的小运动，会意外愉悦。",
      "睡前少看屏幕，今晚的睡眠会很滋补。",
      "适合补水、晒一会儿太阳，身体会回报你。",
    ],
    mid: [
      "身体不疲也不轻，按时吃饭就是最好的照顾。",
      "今天少熬夜，不熬就是赚。",
      "做一件让身体放松的小事：散步、泡脚、伸展，都行。",
    ],
    low: [
      "身体偏紧，别勉强自己，能取消的应酬就取消。",
      "今天宜清淡饮食，少冷少辣，注意保暖。",
      "记得喝水，留意偏头痛、肠胃、睡眠这些信号。",
    ],
  },
  人际: {
    high: [
      "今天人缘软，主动打声招呼会有意想不到的回响。",
      "贵人就在身边，别忘了顺手谢谢最近帮你的人。",
      "适合走出小圈子聊一聊，会有人记得你。",
    ],
    mid: [
      "人际上不必强求热闹，能处的人继续处，能慢的就慢。",
      "今天的小聚要轻松，不必谈正事。",
      "群里少发言反而省心。",
    ],
    low: [
      "今天对话容易擦枪走火，少表态，多观察。",
      "群消息可以不回，自己的节奏更重要。",
      "复杂关系不必今日处理，等心情清一些。",
    ],
  },
  心情: {
    high: [
      "状态轻盈，今天做什么都比平时多三分愉悦。",
      "心里像被风轻轻抚过，把这股劲用在喜欢的事上。",
      "记得记录一下今天的好心情，将来翻出来还会暖。",
    ],
    mid: [
      "情绪稳，做事不亢不卑刚刚好。",
      "今天不需要大喜大悲，平淡就是好。",
      "保持现在的节奏，不必给自己加情绪戏。",
    ],
    low: [
      "情绪偏低落，先承认它，再做让自己舒服的事。",
      "今天宜独处少社交，看一部温和的电影。",
      "心里闷的话，写两句日记会舒展些。",
    ],
  },
};

function tierOf(score: number): Tier {
  if (score >= 80) return "high";
  if (score >= 65) return "mid";
  return "low";
}

/**
 * 找出亮点维度（最高分）和短板维度（最低分）
 */
function findSpotlight(scores: DimensionScores7): DailyDim7 {
  const dims: ReadonlyArray<DailyDim7> = [
    "爱情", "财富", "事业", "学习", "健康", "人际", "心情",
  ];
  let best: DailyDim7 = dims[0];
  for (const d of dims) {
    if (scores[d] > scores[best]) best = d;
  }
  return best;
}

/**
 * stable hash — 同一天同一档案返回同一句
 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 从7维分数生成叙事性一句话总评
 *
 * 策略：找到最高分维度（亮点），按其 tier 从对应池子选一句。
 * 如果亮点维度是 high 且有短板维度是 low，文案会自然体现"此消彼长"。
 */
export function pickOneLiner7(scores: DimensionScores7, date: string): string {
  const spotlight = findSpotlight(scores);
  const tier = tierOf(scores[spotlight]);
  const pool = BY_SPOTLIGHT[spotlight][tier];
  const seed = hashString(date + spotlight + tier);
  return pool[seed % pool.length] ?? pool[0] ?? "";
}

/**
 * V1 兼容入口 — 接收旧版 DailyScores（6维），内部转换为7维调用
 */
export function pickOneLiner(scores: { overall: number; date: string; meta: { dayPillar: { gan: string; zhi: string } } }): string {
  // V1 调用方只传 6 维 DailyScores，这里用 overall 反推一个均匀 7 维给 pickOneLiner7
  const uniform: DimensionScores7 = {
    爱情: scores.overall,
    财富: scores.overall,
    事业: scores.overall,
    学习: scores.overall,
    健康: scores.overall,
    人际: scores.overall,
    心情: scores.overall,
  };
  return pickOneLiner7(uniform, scores.date);
}
