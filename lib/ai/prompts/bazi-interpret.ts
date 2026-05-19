import "server-only";
import type { BaziChartV2 } from "@/lib/bazi/chart";

/**
 * 八字 V2 解读 prompt 模板 (M3.12)
 *
 * 多层叠加结构：
 *   1. SYSTEM_BASE：温柔陪伴风 + 字数 / 禁词 / 风格锁
 *   2. user prompt：命盘 / 日主 / 五行 / 神煞 / 大运 / 流年 / 用神
 *   3. focus 锁定：要求按指定维度解读
 *
 * 设计原则：
 *   - 不让 AI 决策 "是否说凶" — 通过禁词 + 神煞解读文本预先柔化
 *   - 给 AI 充分上下文（神煞 + 用神 + 流年）让它有抓手
 *   - 字数 350-500 防止扯太长
 */

/**
 * 八字解读模版 — 对齐《福小运需求文档》& 测试bug.xlsx R12
 *
 * 输出结构（4 段，段间空行；段落不要任何【】《》[] 前缀，方便 UI 直接平铺）：
 *   1. 命格定调 1-2 句：日主 + 格局 + 用神，自然语言介绍（不要罗列术语表）
 *   2. 维度解读 2-3 段：围绕用户选的 focus，结合神煞 / 大运 / 流年给抓手
 *   3. 趋势节点 1 段：本年 + 下一步大运的关键节点和注意事项
 *   4. 行动建议 + 一句温柔收尾
 *
 * 风格锁：
 *   - 字数 380-520，避免长篇大论让用户失去耐心
 *   - 禁断言式结论；用「适合 / 可以试着 / 留意」代替「会 / 必」
 *   - 把"凶"信号翻译成「先慢一点」「宜稳」等柔和说法
 */
const SYSTEM_BASE = [
  "你是温柔细致的八字老师，坚持温和不武断的解读风格，语气年轻化但不失专业感。",
  "全文 380-520 字，分 4 段，段间空行；不要使用任何 Markdown 标题（# / ## / ###）、加粗符号（** / __）或【】《》[] 标签前缀，段落直接是中文句子。",
  "段落顺序固定：",
  "  · 第 1 段：1-2 句把命格定个调（日主 / 格局 / 用神），用自然语言，不要罗列术语表",
  "  · 第 2 段：围绕用户选的【focus】给 2-3 段抓手式解读，引用给到的神煞 / 用神 / 五行做依据",
  "  · 第 3 段：当前流年 + 下一步大运的关键节点 / 适合做的事 / 需留意的事",
  "  · 第 4 段：2-3 条具体可执行的行动建议 + 1 句温柔收尾（不要「加油」「相信自己」式空话）",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然。负面信号一律转成「先慢一步、沉住气、宜稳、适合静一静」等柔和说法。",
  "结合给定的神煞 / 大运 / 流年 / 用神信息有理有据，不空泛；不要拒答用户的问题。",
].join("\n");

export type V2DivinationDim =
  | "综合运势"
  | "事业学业"
  | "财运"
  | "感情姻缘"
  | "人际贵人"
  | "平安健康";

export interface BuildBaziPromptArgs {
  chart: BaziChartV2;
  /** 用户选的解读维度 */
  focus: V2DivinationDim | string;
  /** 用户报的具体问题（可选；优先级高于 focus） */
  userQuestion?: string;
  /** 档案信息（性别 / 出生地 / 历法），用于 prompt 拼接 */
  profile?: {
    gender?: "male" | "female";
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    calendarType?: "solar" | "lunar";
  };
}

export interface BuildBaziPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildBaziPrompt(args: BuildBaziPromptArgs): BuildBaziPromptResult {
  const { chart, focus, userQuestion, profile } = args;

  // shensha 拆吉/凶/中三组，便于 AI 行文
  const ji = chart.shensha
    .filter((s) => s.polarity === "吉")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");
  const xiong = chart.shensha
    .filter((s) => s.polarity === "凶")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");
  const zhong = chart.shensha
    .filter((s) => s.polarity === "中")
    .map((s) => `${s.name}（${s.interpretation}）`)
    .join("；");

  const liunianText = chart.liunian
    .map((l) => `${l.year}=${l.pillar}${l.offset === 0 ? "(本年)" : ""}`)
    .join("、");

  const currentDayun = chart.luckPillars.find(
    (d) => {
      // 不直接判定当前年龄；选第 3 步作为概略"当前大运"占位
      // 精确版需要 birthDate 计算虚岁，这里 prompt 把 8 步全列即可
      void d;
      return false;
    },
  );
  void currentDayun;

  const dayunText = chart.luckPillars
    .map((d) => `${d.gan}${d.zhi}(${d.age}-${d.age + 9})`)
    .join("、");

  const fiveText = (Object.entries(chart.fiveElements) as Array<[string, number]>)
    .map(([k, v]) => `${k}${v}`)
    .join(" ");

  const focusLabel = userQuestion ? `${focus} - ${userQuestion}` : focus;

  const systemPrompt = `${SYSTEM_BASE}\n本次按【${focusLabel}】角度解读。`;

  const userPromptLines = [
    `命盘：年=${chart.pillars.year.gan}${chart.pillars.year.zhi}，月=${chart.pillars.month.gan}${chart.pillars.month.zhi}，日=${chart.pillars.day.gan}${chart.pillars.day.zhi}，时=${chart.pillars.hour.gan}${chart.pillars.hour.zhi}`,
    `日主：${chart.dayMaster}`,
    `五行：${fiveText}`,
    `格局：${chart.yongShen.gejuType}（强度 ${chart.yongShen.strength}/100）`,
    `用神：${chart.yongShen.yongShen}（${chart.yongShen.reason}）`,
    chart.yongShen.jiShen ? `忌神：${chart.yongShen.jiShen}` : "",
    ji ? `吉神：${ji}` : "",
    zhong ? `中性神煞：${zhong}` : "",
    xiong ? `需注意：${xiong}` : "",
    `大运 8 步：${dayunText}`,
    `流年：${liunianText}`,
    profile?.gender
      ? `性别：${profile.gender === "male" ? "男" : "女"}` +
        (profile.birthPlace ? ` 出生地：${profile.birthPlace}` : "")
      : "",
    "",
    `请按【${focusLabel}】角度解读，结构和字数请遵守 system prompt。`,
  ].filter((l) => l.length > 0);

  return {
    systemPrompt,
    userPrompt: userPromptLines.join("\n"),
  };
}
