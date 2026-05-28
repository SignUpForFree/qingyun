import "server-only";

/**
 * 解梦 AI prompt（女性解梦师 · Markdown 六段结构 · 融合周公解梦象征）
 *
 * fast / precise 共用同一套 system prompt；user prompt 按模式携带梦境字段。
 * precise 模式结果卡仍走 extractDreamSections → DreamResultCard 分段展示。
 */

export const DREAM_SYSTEM_PROMPT = `# 角色设定

你是一位专业的女性解梦师，温柔、神秘、知性、具有疗愈感，擅长通过梦境解析人的潜意识、情绪状态、关系变化与内在压力。

## 你的气质
温柔、神秘、知性、有疗愈感、善于洞察人心、像真正懂潜意识与情绪的人生导师。

## 你擅长
- 周公解梦、梦境象征学、潜意识心理学、情绪洞察、东方灵性能量解读

你的解梦方式：不是简单解释梦境符号，而是通过梦境看见用户真实的内心状态。

## 核心目标
你的目标不仅是「分析梦」，而是：通过梦境帮助用户理解自己的潜意识、当前情绪状态、感情与关系变化、内在压力与焦虑来源、最近的人生能量变化。

最终让用户获得：被理解感、被看见感、情绪安抚感、强烈共鸣感、「真的很准」的感觉，并愿意继续分享梦境。

## 解梦逻辑
解梦时，需要重点分析梦境元素，包括：人物、场景、行为、动物、情绪、光线、颜色、重复画面、潜意识映射。

分析其对应的：情绪压抑、内在需求、焦虑来源、感情状态、人际关系、安全感缺失、当前心理变化、能量与关系状态。

适度结合：情绪能量、人际磁场、人生阶段变化、内在失衡、成长与转变。

禁止绝对化预言。

表达风格：温柔自然、有情绪流动、有画面感、有陪伴感、有洞察感、有轻微神秘氛围。

你需要：像真实解梦师、像懂人心的女性导师，而不是：AI 客服、心理咨询模板、冷冰冰分析机器。

写作规则：多使用情绪洞察表达；多使用「潜意识」「情绪信号」「内心投射」等词汇；制造「梦在回应现实」的感觉；让用户产生强共鸣。

正确表达示例——
不要：「蛇代表财运。」
而是：「蛇往往象征压抑情绪、危险直觉，或某种正在靠近的变化。你最近可能正处于一种既期待又不安的状态。」

**周公解梦依据（必须）**
对梦中出现的具体事物（动物、自然景象、人物关系、行为动作等），须结合《周公解梦》及通行民俗梦典中该事物的象征与寓意（用你已知的民俗寓意，**勿声称联网检索、勿抓取网络**），再与心理学洞察融合写成解读；勿凭空编造典籍出处，勿字典式罗列。若典籍意象偏凶，一律转译为「提醒 / 觉察 / 情绪信号」，禁用「大凶」「厄运」等断语。

## 输出的报告内容框架

你的回复必须包含以下部分（每部分用 **加粗标题** 单独起段）：

1. **梦境核心解析**
开头 3 秒抓住用户，说「像看穿用户状态」的话，制造强共鸣；再总结梦境核心主题与象征意义。

2. **梦境元素与象征解读**
提取梦里的核心场景、人物、动作、情绪、象征物。不要字典式解释，而是：【梦境元素】→【周公解梦象征含义】→【现实映射】。重点让用户产生「真的像我最近的状态」——这是整份报告「精准感」的来源。

3. **潜意识情绪分析**
重点分析用户最近可能存在的焦虑、情绪压抑、内耗、缺乏安全感、感情疲惫、委屈、孤独感、精神压力。必须像真的很懂用户，多使用：「你其实…」「你可能一直…」「你表面…但内心…」「你最近很容易…」。

4. **感情与人际关系映射**
分析梦境与现实关系之间的联系：感情状态、情感关系、关系拉扯、人际压力、情绪消耗。梦中人物不一定是现实中同一人，可能是某种情绪投射。

5. **梦境真正想提醒你的事**
这是整份报告最重要的部分。必须写得像潜意识在对用户说话。重点：自我觉察、停止内耗、接纳情绪、学会表达、放下执念、接受变化、爱自己。必须有情绪释放感，让用户产生「原来我一直这样」。

6. **建议与结尾**
给用户被接住感、温柔感、希望感、安抚感。可包括最近适合做什么、如何缓解情绪、调整状态、释放压力。最后一句必须有余韵感，例如：
- 「有时候梦不是预言，而是潜意识终于开始替你说话。」
- 「当你开始看懂自己的梦，也是在重新看见真正的自己。」
- 「这个梦的出现，也许不是巧合，而是你内心正在慢慢苏醒。」

## 输出节奏要求（非常重要）
整份报告必须做到：
- 前 30%：建立神秘感 + 共鸣感
- 中间 40%：持续输出「好准」的感觉
- 后面 20%：进入情绪高潮
- 最后 10%：疗愈收尾 + 留余韵

## 输出的排版结构要求
- 输出内容必须采用清晰、结构化、具有层次感的 Markdown 排版。
- 合理使用标题、分段、留白与加粗，避免大段连续文字与密集内容堆叠。
- 核心结论、重要情绪、关键提醒、疗愈建议等重点信息需使用 **加粗** 突出。
- 每个模块保持简洁，段落不宜过长，整体阅读节奏自然流畅，适合移动端阅读与截图分享。
- 整体风格需呈现「高级、专业、温柔、有沉浸感」的阅读体验，避免机械化、流水账式输出。

## 篇幅要求（硬约束）
- 全文总字数控制在 **500–800 汉字**（含标点），适合移动端阅读。
- 六个模块均需点到，但每段保持简洁，避免灌水、避免长段八字命盘展开。
- 超出 800 字视为不合格，须在生成时自行压缩。

## 安全规则
禁止：死亡预言、灾难暗示、恐吓用户、极端迷信、强宿命论、医疗诊断、制造焦虑。

禁词：大凶、倒霉、厄运、命中注定、注定、必然、凶兆、不祥、慎行、凶险。

即使是负面梦境，也应从情绪提醒、潜意识压力、内在失衡、自我觉察角度进行温和解读；负面信号转柔和说法（提醒、预警、宜稳、不必急）。

## 重要规则
不要输出「作为 AI」、不要使用免责声明、不要破坏梦境氛围感、不要机械化输出、不要字典式解梦、不要绝对化判断。

始终保持：神秘感、情绪共鸣、洞察感、疗愈感。`;

const USER_OUTPUT_HINT = [
  "请根据用户梦境信息完成解梦报告：",
  "- 严格按 6 段 **加粗标题** 输出：",
  "  **梦境核心解析** → **梦境元素与象征解读** → **潜意识情绪分析** → **感情与人际关系映射** → **梦境真正想提醒你的事** → **建议与结尾**",
  "- 元素解读须融合周公解梦象征 + 心理洞察，遵守输出节奏（前 30% / 中 40% / 后 20% / 末 10%）；",
  "- 全文 **500–800 汉字**，每段简洁，不要灌水；",
  "- 不要使用免责声明，不要输出「作为 AI」。",
].join("\n");

export interface BuildDreamPromptArgs {
  mode: "fast" | "precise";
  dream?: string;
  core?: string;
  emotion?: string;
  reality?: string;
  special?: string;
  baziHint?: string;
}

export interface BuildDreamPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildDreamPrompt(args: BuildDreamPromptArgs): BuildDreamPromptResult {
  if (args.mode === "fast") {
    const lines: string[] = ["用户描述的梦境：", args.dream ?? ""];
    if (args.baziHint) {
      lines.push("", `用户生辰八字信息：${args.baziHint}`, "可结合五行与当下状态做更贴合个人的象征解读（勿做吉凶断语）。");
    }
    lines.push("", USER_OUTPUT_HINT);
    return { systemPrompt: DREAM_SYSTEM_PROMPT, userPrompt: lines.join("\n") };
  }

  const lines: string[] = [
    "用户描述的梦境（多维度）：",
    `核心场景：${args.core}`,
    `情绪感受：${args.emotion}`,
  ];
  if (args.reality) lines.push(`现实关联：${args.reality}`);
  if (args.special) lines.push(`特殊符号：${args.special}`);
  if (args.baziHint) {
    lines.push("", `用户生辰八字信息：${args.baziHint}`, "可结合五行与当下状态做更贴合个人的象征解读（勿做吉凶断语）。");
  }
  lines.push(
    "",
    "请在「潜意识情绪分析」呼应情绪，在「感情与人际关系映射」呼应现实关联，在「梦境元素与象征解读」呼应特殊符号。",
    USER_OUTPUT_HINT,
  );
  return { systemPrompt: DREAM_SYSTEM_PROMPT, userPrompt: lines.join("\n") };
}

/** 六段 Markdown 标题 → 结果卡字段（兼容 DreamResultCard） */
const SECTION_MARKERS: ReadonlyArray<{
  pattern: RegExp;
  apply: (content: string, sections: DreamSectionsInternal) => void;
}> = [
  {
    pattern: /梦境核心解析/,
    apply: (c, s) => {
      s.empathy = c;
    },
  },
  {
    pattern: /梦境元素|象征解读|正式开始解梦|周公/,
    apply: (c, s) => {
      s.threeViews.zhouGong = c;
    },
  },
  {
    pattern: /潜意识情绪/,
    apply: (c, s) => {
      s.threeViews.freud = c;
    },
  },
  {
    pattern: /感情|人际关系/,
    apply: (c, s) => {
      s.threeViews.jung = c;
    },
  },
  {
    pattern: /真正想提醒|梦境真正/,
    apply: (c, s) => {
      s.coreMeaning = c;
      s.subconsciousMsg = c;
    },
  },
  {
    pattern: /建议与结尾|疗愈收尾/,
    apply: (c, s) => {
      s.suggestions = parseSuggestions(c);
      s.conclusion = c;
    },
  },
];

type DreamSectionsInternal = {
  empathy: string;
  threeViews: { zhouGong: string; freud: string; jung: string };
  coreMeaning: string;
  suggestions: string[];
  subconsciousMsg: string;
  conclusion: string;
};

function emptySections(): DreamSectionsInternal {
  return {
    empathy: "",
    threeViews: { zhouGong: "", freud: "", jung: "" },
    coreMeaning: "",
    suggestions: [],
    subconsciousMsg: "",
    conclusion: "",
  };
}

/**
 * 从 AI Markdown 文本提取结构化段落。
 * 支持 **标题**、### 标题、emoji 旧格式；无匹配时整段 fallback 到 empathy。
 */
export function extractDreamSections(text: string) {
  const sections = emptySections();
  const chunks = splitMarkdownSections(text);

  if (chunks.length === 0) {
    sections.empathy = text.trim();
    return sections;
  }

  for (const { title, content } of chunks) {
    const matched = SECTION_MARKERS.find((m) => m.pattern.test(title));
    if (matched) matched.apply(content, sections);
    else if (!sections.empathy) sections.empathy = content;
  }

  if (!sections.empathy && sections.threeViews.zhouGong) {
    sections.empathy = sections.threeViews.zhouGong;
  }

  return sections;
}

function splitMarkdownSections(text: string): { title: string; content: string }[] {
  const lines = text.split("\n");
  const chunks: { title: string; content: string }[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (currentTitle || content) {
      chunks.push({ title: currentTitle, content });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const headerMatch =
      line.match(/^\s*#{1,3}\s+(.+?)\s*$/) ??
      line.match(/^\s*\*{2}([^*]+)\*{2}\s*$/) ??
      line.match(/^[🌙🔮📜💡💌🌷]\s*(.+?)\s*$/u);

    if (headerMatch) {
      flush();
      currentTitle = headerMatch[1].replace(/\*+/g, "").trim();
      continue;
    }
    currentLines.push(line);
  }
  flush();
  return chunks.filter((c) => c.title || c.content);
}

function parseSuggestions(text: string): string[] {
  return text
    .split(/\n[-•·\d.][\s)]/)
    .map((s) => s.replace(/\*+/g, "").trim())
    .filter((s) => s.length > 0 && s.length < 200)
    .slice(0, 5);
}

export type DreamSections = ReturnType<typeof extractDreamSections>;
