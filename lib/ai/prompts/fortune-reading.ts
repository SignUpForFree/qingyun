import "server-only";
import type { DailyDim7, DimensionScores7 } from "@/lib/fortune/daily-7dim";
import type { Attributes } from "@/lib/fortune/attributes";

/**
 * 首页 daily fortune AI 解读 prompt (M3.28)
 *
 * 约束：
 *   - 7 段，按 7 维度顺序：爱情 / 财富 / 事业 / 学习 / 健康 / 人际 / 心情
 *   - 每段 60-80 字
 *   - 每段以【维度 分数】开头，与本地 fallback 同结构（保证 AI 失败回退无缝）
 *   - 6 禁词锁
 *   - 最后用一句开放性 closing 收尾（不计入 7 段）
 */

const SYSTEM_BASE = [
  "你是温柔细致的命理老师，每天早上给一段全 7 维度运势速读。",
  "结构：7 段，按【爱情】【财富】【事业】【学习】【健康】【人际】【心情】顺序。",
  "每段以【维度 NN】开头（NN 是分数），后接 60-80 字解读。最后用 1 句温和的开放性收尾。",
  "禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；只保留【维度 NN】作段落前缀，其余用纯文本。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然。负面信号转柔和说法（先慢一步、沉住气、宜稳）。",
  "结合给定的分数 + 当日干支 + lucky 属性有理有据，不要写空泛的鸡汤。",
].join("\n");

export interface BuildFortuneReadingPromptArgs {
  date: string;
  dayPillar: { gan: string; zhi: string };
  scores: DimensionScores7;
  attributes: Attributes;
  /** 可选：日主五行 / 用神 给 AI 一个抓手 */
  dayMaster?: string;
  yongShen?: string;
  /** 可选 one-liner，让 AI 把它消化成开场氛围 */
  oneLiner?: string;
}

export interface BuildFortuneReadingPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

const DIM_ORDER: ReadonlyArray<DailyDim7> = [
  "爱情",
  "财富",
  "事业",
  "学习",
  "健康",
  "人际",
  "心情",
];

export function buildFortuneReadingPrompt(
  args: BuildFortuneReadingPromptArgs,
): BuildFortuneReadingPromptResult {
  const lines: string[] = [
    `日期：${args.date}（${args.dayPillar.gan}${args.dayPillar.zhi}日）`,
  ];
  if (args.dayMaster) lines.push(`日主：${args.dayMaster}`);
  if (args.yongShen) lines.push(`用神：${args.yongShen}`);

  lines.push("分数：");
  for (const dim of DIM_ORDER) {
    lines.push(`  ${dim}: ${args.scores[dim]}`);
  }

  lines.push(
    "",
    "lucky 属性：",
    `  幸运色：${args.attributes.color.name}（${args.attributes.color.hex}）`,
    `  方位：${args.attributes.direction}`,
    `  时辰：${args.attributes.hour.range}`,
    `  数字：${args.attributes.number}`,
    `  花：${args.attributes.flower}`,
    `  事物：${args.attributes.item}`,
    `  配饰：${args.attributes.accessory}`,
    `  食物：${args.attributes.food}`,
  );

  if (args.oneLiner) {
    lines.push("", `one-liner（可参考但不要照抄）：${args.oneLiner}`);
  }

  lines.push("", "请按 system prompt 的结构和字数要求输出 7 段解读 + 1 句收尾。");

  return {
    systemPrompt: SYSTEM_BASE,
    userPrompt: lines.join("\n"),
  };
}
