/**
 * 解签 AI 输出 → 结构化 sections（客户端 / 服务端共用，无 server-only）
 */

export interface SlipSection {
  emoji: string;
  label: string;
  shortReading: string;
  longReading: string;
}

const DIM_SECTIONS = [
  { emoji: "📊", label: "综合运势", key: "overall" },
  { emoji: "💼", label: "事业学业", key: "career" },
  { emoji: "💰", label: "财运", key: "wealth" },
  { emoji: "❤", label: "感情姻缘", key: "love" },
  { emoji: "🤝", label: "人际贵人", key: "social" },
  { emoji: "🍵", label: "平安健康", key: "health" },
] as const;

const CLOSING_SECTION = { emoji: "✨", label: "福小运寄语", key: "closing" } as const;

const ALL_SECTIONS = [...DIM_SECTIONS, CLOSING_SECTION];

/**
 * 从 AI 输出文本提取结构化 sections（emoji 标签行分段）。
 * 流式过程中可反复调用，已完成的块会随文本增长逐步出现。
 */
export function extractSlipSections(text: string): SlipSection[] {
  const sections: SlipSection[] = [];
  const matches: {
    index: number;
    sectionDef: (typeof ALL_SECTIONS)[number];
    contentStart: number;
  }[] = [];

  for (const sec of ALL_SECTIONS) {
    const pattern = new RegExp(
      `^${escapeRegExp(sec.emoji)}\\s*${escapeRegExp(sec.label)}\\s*$`,
      "gmu",
    );
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({
        index: m.index,
        sectionDef: sec,
        contentStart: m.index + m[0].length,
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  if (matches.length === 0) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    return [
      {
        emoji: "📊",
        label: "综合运势",
        shortReading: trimmed.slice(0, 100),
        longReading: trimmed,
      },
    ];
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.contentStart;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    const content = text.slice(start, end).trim();
    const parts = content.split(/\n\s*\n/);
    const shortReading = (parts[0] ?? "").trim();
    const longReading = parts.length > 1 ? parts.slice(1).join("\n\n").trim() : "";

    sections.push({
      emoji: matches[i]!.sectionDef.emoji,
      label: matches[i]!.sectionDef.label,
      shortReading,
      longReading,
    });
  }

  return sections;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
