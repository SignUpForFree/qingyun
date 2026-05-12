import "server-only";

/**
 * 解梦 AI prompt 模板 (V1.0 需求对齐)
 *
 * 多层叠加：
 *   1. SYSTEM_BASE：温柔具体不空泛 + 段落结构 + 禁词锁
 *   2. MODE_HINTS：fast / precise 两种模式切换
 *   3. user prompt：梦境描述 / 精准模式 4 字段
 *
 * precise 模式 7 段结构（需求 §解梦内容）：
 *   🌙 开篇共情 → 🔮 三重维度专业解读 → 📜 核心寓意与重要节点指引
 *   → 💡 可落地的规避方案 → 💌 潜意识真心话 → 🌷 结语
 */

const SYSTEM_BASE = [
  "你是温柔的解梦顾问，融合现代心理学 + 传统象征 + 生活实用视角，语气温柔不武断。",
  "禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；段落直接换行，不要带任何标签前缀。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然 / 凶兆 / 不祥 / 慎行 / 凶险。",
  "负面信号一律转柔和说法（先慢一步、沉住气、宜稳、留白多一些、不必急、提醒、预警）。",
  "保留具象细节，不写空泛鸡汤。",
].join("\n");

const SYSTEM_PROMPT_FAST = [
  SYSTEM_BASE,
  "",
  "回应控制在 120-220 字。",
  "结构：先用 1-2 句把梦中主要意象说出来 → 再用 1-2 句解读它和情绪 / 状态的可能联系 → 最后用 1 句给柔和的当下建议。",
  "不强加段落标题（用户只发了短梦境，不要堆多段），用空行分隔即可。",
].join("\n");

const SYSTEM_PROMPT_PRECISE = [
  SYSTEM_BASE,
  "",
  "总字数 500-800 字，严格按以下 6 段结构输出，每段用 emoji 标签开头：",
  "",
  "🌙 开篇共情",
  "温柔接住用户的恐惧/焦虑，明确说明「不是厄运，是潜意识的预警」。1-2 句。",
  "",
  "🔮 三重维度专业解读",
  "分 3 小段，每段先写维度标签再写解读：",
  "  周公解梦 · 民俗意象解读：把传统「凶兆」转化为「需要关注的提醒/善意信号」，绝对禁用「凶/大凶/厄运」，只说「提醒/预警」。",
  "  弗洛伊德 · 愿望满足理论：解读为「现实压力/焦虑的投射」，锚定用户当下的现实问题，说明是「内心的求救」，不是「注定倒霉」。",
  "  荣格 · 集体无意识与原型：解读为「内在自我的预警/成长信号」，强化「帮你调整、避坑」的正向定位。",
  "",
  "📜 核心寓意与重要节点指引",
  "整体寓意：明确「不是厄运，是潜意识的XX预警/提醒」。重要节点风险提示以表格形式呈现（生活节点 | 风险提示（委婉表达） | 核心指引），列出 2-3 个节点。最后写「必须注意的X件事」（明确、可落地）。",
  "",
  "💡 可落地的规避方案",
  "3-4 条简单、贴合日常的具体方法，每条 1-2 句。",
  "",
  "💌 潜意识想对你说的真心话",
  "共情、安抚、肯定，戳中用户没说出口的心事，给足情绪价值。2-3 句。",
  "",
  "🌷 结语",
  "正向、治愈，强调「调整后就能顺利化解」，给用户信心。1-2 句。",
  "",
  "用户填的『特殊符号』如果存在，请在🔮三重维度解读中顺势呼应，不要忽略。",
  "用户填的『现实关联』如果存在，请在弗洛伊德段落重点呼应。",
].join("\n");

export interface BuildDreamPromptArgs {
  mode: "fast" | "precise";
  /** fast 模式：梦境描述 */
  dream?: string;
  /** precise 模式 4 字段 */
  core?: string;
  emotion?: string;
  reality?: string;
  special?: string;
}

export interface BuildDreamPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildDreamPrompt(args: BuildDreamPromptArgs): BuildDreamPromptResult {
  if (args.mode === "fast") {
    return {
      systemPrompt: SYSTEM_PROMPT_FAST,
      userPrompt: `用户的梦：${args.dream}\n\n请给一段简短温柔的解读。`,
    };
  }

  const lines: string[] = [
    "用户描述的梦境（4 字段）：",
    `核心场景：${args.core}`,
    `情绪感受：${args.emotion}`,
  ];
  if (args.reality) lines.push(`现实关联：${args.reality}`);
  if (args.special) lines.push(`特殊符号：${args.special}`);
  lines.push("", "请按 [🌙 → 🔮 → 📜 → 💡 → 💌 → 🌷] 6 段结构生成完整解读。");

  return {
    systemPrompt: SYSTEM_PROMPT_PRECISE,
    userPrompt: lines.join("\n"),
  };
}

/**
 * 从 AI precise 文本里提取 6 段结构化内容。
 *
 * AI 输出格式（prompt 约束）：
 *   🌙 开篇共情...
 *   🔮 三重维度专业解读...
 *     周公解梦 · 民俗意象解读...
 *     弗洛伊德 · 愿望满足理论...
 *     荣格 · 集体无意识与原型...
 *   📜 核心寓意与重要节点指引...
 *   💡 可落地的规避方案...
 *   💌 潜意识想对你说的真心话...
 *   🌷 结语...
 *
 * 容错：AI 不严格遵守时 fallback 到整段。
 */
export function extractDreamSections(text: string) {
  const sections = {
    empathy: "",       // 🌙
    threeViews: {      // 🔮
      zhouGong: "",    // 周公解梦
      freud: "",       // 弗洛伊德
      jung: "",        // 荣格
    },
    coreMeaning: "",   // 📜
    suggestions: [] as string[], // 💡
    subconsciousMsg: "", // 💌
    conclusion: "",    // 🌷
  };

  // 按 emoji 标签行切分（emoji 可能是多字节，用 u flag）
  const sectionPattern = /^[🌙🔮📜💡💌🌷]\s*/gmu;
  const matches: { index: number; label: string; contentStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionPattern.exec(text)) !== null) {
    const label = m[0].trim();
    matches.push({
      index: m.index,
      label,
      contentStart: m.index + m[0].length,
    });
  }

  // 如果没切出任何 section，fallback
  if (matches.length === 0) {
    sections.empathy = text;
    return sections;
  }

  // 提取每个 section 的内容（到下一个 section 开始为止）
  const chunks: { label: string; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].contentStart;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    chunks.push({ label: matches[i].label, content });
  }

  for (const chunk of chunks) {
    // label 包含 emoji 字符，用 includes 匹配避免编码问题
    if (chunk.label.includes("开篇") || chunk.label.includes("共情") || chunk.label.includes("\u{1F319}")) {
      sections.empathy = chunk.content;
    } else if (chunk.label.includes("三重") || chunk.label.includes("维度") || chunk.label.includes("\u{1F52E}")) {
      parseThreeViews(chunk.content, sections.threeViews);
    } else if (chunk.label.includes("核心") || chunk.label.includes("寓意") || chunk.label.includes("\u{1F4DC}")) {
      sections.coreMeaning = chunk.content;
    } else if (chunk.label.includes("规避") || chunk.label.includes("方案") || chunk.label.includes("\u{1F4A1}")) {
      sections.suggestions = parseSuggestions(chunk.content);
    } else if (chunk.label.includes("潜意识") || chunk.label.includes("真心") || chunk.label.includes("\u{1F48C}")) {
      sections.subconsciousMsg = chunk.content;
    } else if (chunk.label.includes("结语") || chunk.label.includes("\u{1F337}")) {
      sections.conclusion = chunk.content;
    }
  }

  return sections;
}

function parseThreeViews(
  text: string,
  out: { zhouGong: string; freud: string; jung: string },
) {
  // 尝试按维度关键词切
  const zhouMatch = text.match(/周公解梦[^\n]*\n?([\s\S]*?)(?=弗洛伊德|$)/);
  const freudMatch = text.match(/弗洛伊德[^\n]*\n?([\s\S]*?)(?=荣格|$)/);
  const jungMatch = text.match(/荣格[^\n]*\n?([\s\S]*)/);

  out.zhouGong = zhouMatch?.[1]?.trim() ?? "";
  out.freud = freudMatch?.[1]?.trim() ?? "";
  out.jung = jungMatch?.[1]?.trim() ?? "";

  // fallback：如果三个都没切到，整段放 zhouGong
  if (!out.zhouGong && !out.freud && !out.jung) {
    out.zhouGong = text;
  }
}

function parseSuggestions(text: string): string[] {
  return text
    .split(/\n[-•·\d.][\s)]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 200)
    .slice(0, 5);
}

export type DreamSections = ReturnType<typeof extractDreamSections>;
