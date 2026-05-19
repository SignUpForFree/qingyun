import "server-only";
import type { SlipLevel } from "@/lib/divination/slip-level";

/**
 * 抽签 AI 二次解读 prompt 模板 (V1.0 需求对齐)
 *
 * 多层叠加：
 *   1. SYSTEM_BASE：温和具体不空泛 + 段落结构 + 禁词锁
 *   2. LEVEL_TONE_HINTS：根据 6 级 SlipLevel（上上/上吉/吉/平/渐顺/慎行）切换语气
 *   3. user prompt：签号 + 签名 + 4 句签诗 + category + 静态解签词参考
 *
 * V1.0 emoji 标签格式：
 *   📊 综合运势 / 💼 事业学业 / 💰 财运 / ❤ 感情姻缘 / 🤝 人际贵人 / 🍵 平安健康 / ✨ 福小运寄语
 *
 * isFullInterpret：
 *   true  → 生成全部 7 块
 *   false → 只生成 category 对应的 1 块 + ✨ 福小运寄语
 */

const SYSTEM_BASE = [
  "你是福小运的资深解签师，坚持温和具体、不空泛、不武断的风格。",
  "禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；段落直接换行，不要带任何标签前缀。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 / 慎行 / 凶险。",
  "负面信号一律转柔和说法（先慢一步、沉住气、宜稳、留白多一些、不必急）。",
  "保留具象细节，不写空泛鸡汤。",
].join("\n");

/** 每块结构：1-2 句简短解读 + 3-5 句详细展开 */
const SECTION_FORMAT = [
  "每块结构：先用 1-2 句给出简短解读（一句话概括），再用 3-5 句详细展开，给出具体、可感受、有画面感的解读。",
  "简短解读和详细展开之间用空行分隔。",
].join("\n");

const DIM_SECTIONS = [
  { emoji: "📊", label: "综合运势", key: "overall" },
  { emoji: "💼", label: "事业学业", key: "career" },
  { emoji: "💰", label: "财运", key: "wealth" },
  { emoji: "❤", label: "感情姻缘", key: "love" },
  { emoji: "🤝", label: "人际贵人", key: "social" },
  { emoji: "🍵", label: "平安健康", key: "health" },
] as const;

const CLOSING_SECTION = { emoji: "✨", label: "福小运寄语", key: "closing" } as const;

/** category 到 section key 的映射 */
const CATEGORY_TO_KEY: Record<string, string> = {
  "综合运势": "overall",
  "事业学业": "career",
  "财运": "wealth",
  "感情姻缘": "love",
  "人际贵人": "social",
  "平安健康": "health",
};

const LEVEL_TONE_HINTS: Record<SlipLevel, string> = {
  上上: "签级偏顺，给祝福同时留余地：成事多在心定，仍需稳步。",
  上吉: "签级吉，鼓励行动同时强调与人为善。",
  吉: "签级中吉，先安住眼前一件事再说，不必铺得太大。",
  平: "签级中平，宜稳不宜冒进，少安排多留白。",
  渐顺: "签级渐顺，方向向好但节奏要稳，别急别躁慢慢来。",
  慎行: "签级偏弱，全程用善意提醒，绝不写凶险词；强调温和复盘 + 自我照顾，不预测灾祸。",
};

export interface BuildSlipPromptArgs {
  slipNumber: number;
  level: SlipLevel;
  title: string;
  poemLines: ReadonlyArray<string>;
  category: string;
  /** 静态解签词参考（来自 SLIPS_V2 的 categoryReadings[category]） */
  reading: string;
  /** 用户具体问题（可选） */
  userQuestion?: string;
  /** true = 生成全部 7 块；false = 只生成 category 对应的 1 块 + ✨ 福小运寄语 */
  isFullInterpret?: boolean;
}

export interface BuildSlipPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildSlipPrompt(args: BuildSlipPromptArgs): BuildSlipPromptResult {
  const tone = LEVEL_TONE_HINTS[args.level] ?? "语气平和稳当";
  const isFull = args.isFullInterpret ?? false;

  let systemPrompt = `${SYSTEM_BASE}\n本签等级（${args.level}）提示：${tone}\n\n${SECTION_FORMAT}`;

  if (isFull) {
    // 完整解读：7 块
    const sectionList = [...DIM_SECTIONS, CLOSING_SECTION]
      .map((s) => `${s.emoji} ${s.label}`)
      .join(" / ");
    systemPrompt += `\n\n请生成全部 7 块解读：${sectionList}。`;
    systemPrompt += `\n字数：700-1000 字。`;
  } else {
    // 部分解读：只生成 category 对应的 1 块 + ✨ 福小运寄语
    const catKey = CATEGORY_TO_KEY[args.category] ?? "overall";
    const targetDim = DIM_SECTIONS.find((d) => d.key === catKey) ?? DIM_SECTIONS[0];
    systemPrompt += `\n\n只生成 2 块解读：${targetDim.emoji} ${targetDim.label} / ${CLOSING_SECTION.emoji} ${CLOSING_SECTION.label}。`;
    systemPrompt += `\n字数：200-350 字。`;
  }

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

  if (isFull) {
    lines.push("", "请按 7 块 emoji 标签结构生成完整解读。");
  } else {
    lines.push("", `请只生成「${args.category}」对应的解读 + ✨ 福小运寄语。`);
  }

  return {
    systemPrompt,
    userPrompt: lines.join("\n"),
  };
}

// ============ 解析 AI 输出为结构化 sections ============

export interface SlipSection {
  emoji: string;
  label: string;
  shortReading: string;
  longReading: string;
}

const ALL_SECTIONS = [...DIM_SECTIONS, CLOSING_SECTION];

/**
 * 从 AI 输出文本提取结构化 sections。
 * AI 输出格式：每块以 emoji 标签行开头。
 */
export function extractSlipSections(text: string): SlipSection[] {
  const sections: SlipSection[] = [];

  // 找到所有 emoji 标签行的位置
  const matches: { index: number; sectionDef: typeof ALL_SECTIONS[number]; contentStart: number }[] = [];

  for (const sec of ALL_SECTIONS) {
    // 匹配 emoji + label 行（可能在行首，也可能前面有换行）
    const pattern = new RegExp(`^${escapeRegExp(sec.emoji)}\\s*${escapeRegExp(sec.label)}\\s*$`, "gmu");
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({
        index: m.index,
        sectionDef: sec,
        contentStart: m.index + m[0].length,
      });
    }
  }

  // 按 index 排序
  matches.sort((a, b) => a.index - b.index);

  if (matches.length === 0) {
    // fallback：整段作为综合运势
    sections.push({
      emoji: "📊",
      label: "综合运势",
      shortReading: text.slice(0, 100).trim(),
      longReading: text.trim(),
    });
    return sections;
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].contentStart;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();

    // 尝试按空行切分 简短解读 / 详细展开
    const parts = content.split(/\n\s*\n/);
    const shortReading = (parts[0] ?? "").trim();
    const longReading = parts.length > 1 ? parts.slice(1).join("\n\n").trim() : "";

    sections.push({
      emoji: matches[i].sectionDef.emoji,
      label: matches[i].sectionDef.label,
      shortReading,
      longReading,
    });
  }

  return sections;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { DIM_SECTIONS, CLOSING_SECTION, CATEGORY_TO_KEY };
