import "server-only";
import type { SpecLevel } from "@/lib/divination/slip-level";

/**
 * 抽签 AI 二次解读 prompt 模板 (M3.4)
 *
 * 多层叠加：
 *   1. SYSTEM_BASE：温和具体不空泛 + 段落结构 + 禁词锁
 *   2. LEVEL_TONE_HINTS：根据 5 档 SpecLevel（上上/上吉/中吉/中平/下下）切换语气
 *      - 下下 / 中平 时强制 "善意提醒"风格，避免 V1 docx "慎行" 等硬词扩散
 *   3. user prompt：签号 + 签名 + 4 句签诗 + category + 静态解签词参考
 *
 * 防御 #20（plan §M3.16）：开源签数据可能保留古风强词；prompt 这一层强制温柔化，
 * 让 AI 把硬词转成"先慢一步"、"宜稳"。
 */

const SYSTEM_BASE = [
  "你是轻运 AI 的资深解签师，坚持温和具体、不空泛、不武断的风格。",
  "结构：开场 1 句呼应用户问题 + 4 段（按签诗 4 句意象）+ 收尾 1 句行动建议。",
  "字数：300-500 字。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 / 慎行 / 凶险。",
  "负面信号一律转柔和说法（先慢一步、沉住气、宜稳、留白多一些、不必急）。",
  "保留具象细节，不写空泛鸡汤。",
].join("\n");

const LEVEL_TONE_HINTS: Record<SpecLevel, string> = {
  上上: "签级偏顺，给祝福同时留余地：成事多在心定，仍需稳步。",
  上吉: "签级吉，鼓励行动同时强调与人为善。",
  中吉: "签级中吉，先安住眼前一件事再说，不必铺得太大。",
  中平: "签级中平，宜稳不宜冒进，少安排多留白。",
  下下: "签级偏弱，全程用善意提醒，绝不写凶险词；强调温和复盘 + 自我照顾，不预测灾祸。",
};

export interface BuildSlipPromptArgs {
  slipNumber: number;
  level: SpecLevel;
  title: string;
  poemLines: ReadonlyArray<string>;
  category: string;
  /** 静态解签词参考（来自 SLIPS_V2 的 categoryReadings[category]） */
  reading: string;
  /** 用户具体问题（可选） */
  userQuestion?: string;
}

export interface BuildSlipPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildSlipPrompt(args: BuildSlipPromptArgs): BuildSlipPromptResult {
  const tone = LEVEL_TONE_HINTS[args.level];
  const systemPrompt = `${SYSTEM_BASE}\n本签等级（${args.level}）提示：${tone}`;

  const lines: string[] = [
    `第 ${args.slipNumber} 签 · ${args.level} · 《${args.title}》`,
    "签诗：",
    ...args.poemLines.map((l, i) => `  ${i + 1}. ${l}`),
    "",
    `问的方向：${args.category}`,
    `静态解签词参考：${args.reading}`,
  ];
  if (args.userQuestion) {
    lines.push("", `用户具体问题：${args.userQuestion}`);
  }
  lines.push("", "请按 [开场 → 4 段意象 → 收尾] 结构生成 300-500 字解读。");

  return {
    systemPrompt,
    userPrompt: lines.join("\n"),
  };
}
