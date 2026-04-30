import "server-only";
import type { MeihuaV2Result } from "@/lib/divination/meihua-v2";

/**
 * 梅花易数 V2 解读 prompt 模板 (M3.22)
 *
 * 多层叠加结构：
 *   1. SYSTEM_BASE：温和老师风 + 字数 / 禁词 / 风格锁
 *   2. user prompt：5 卦推演（本/互/变/卦中卦） + 体用关系 + 时辰能量场 +
 *      五行损益 + 应期 + 卦辞 / 爻辞 / 彖辞文献
 *   3. focus 锁定：用户具体问题
 *
 * 设计原则：
 *   - 不让 AI 决策 "是否说凶" — 通过禁词 + 体用 relation 文本预先柔化
 *   - 给 AI 充分上下文（卦辞 + 爻辞 + 彖辞 + timeEnergy + sunYi）让它有抓手
 *   - 字数 280-450 防止扯太长
 */

const SYSTEM_BASE = [
  "你是温和细致的梅花易数老师，坚持温柔不武断的解读风格。",
  "全文 280-450 字。结构：[卦象速断 60-100 字] / [体用 + 时辰能量 60-100 字] / [应期 + 五行损益 60-100 字] / [收尾 1 句行动建议]。",
  "禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；只保留 [方括号标签] 作段落前缀，其余用纯文本。",
  "禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然。负面信号转柔和说法（先慢一步、沉住气、宜稳）。",
  "结合给定卦辞 / 爻辞 / 彖辞 / 体用 / 时辰 / 五行损益有理有据，不空泛。",
].join("\n");

const TIYONG_LABEL: Record<string, string> = {
  ti_ke_yong: "体克用（自己掌握主动）",
  yong_ke_ti: "用克体（外缘较强，需顺势）",
  ti_sheng_yong: "体生用（付出多，略泄气）",
  yong_sheng_ti: "用生体（外缘加持，大顺）",
  bi_he: "体用比和（平稳）",
};

const YINGQI_LABEL: Record<string, string> = {
  fast: "应期偏快（数日内）",
  medium: "应期中平（约一旬至月内）",
  slow: "应期偏缓（月内或更长）",
};

export interface BuildMeihuaPromptArgs {
  result: MeihuaV2Result;
  /** 用户具体问题（可选） */
  userQuestion?: string;
}

export interface BuildMeihuaPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildMeihuaPrompt(args: BuildMeihuaPromptArgs): BuildMeihuaPromptResult {
  const { result, userQuestion } = args;

  const systemPrompt = userQuestion
    ? `${SYSTEM_BASE}\n本次围绕用户问题：【${userQuestion}】`
    : SYSTEM_BASE;

  const linesArt = formatLines(result.ben.lines);
  const tiYongLine = TIYONG_LABEL[result.tiYong.relation] ?? result.tiYong.relation;
  const yingQiLine = YINGQI_LABEL[result.yingQi.speed] ?? result.yingQi.speed;

  const userPromptLines: string[] = [
    `本卦：${result.benDict.name}（上${result.ben.upper}下${result.ben.lower}）${linesArt}`,
    `卦辞：${result.benDict.panCi}`,
    `彖辞：${result.benDict.tuanCi}`,
    `动爻：第 ${result.dongYao} 爻 — ${result.benDict.dongYaoCi ?? "（无）"}`,
    `互卦：${result.huDict.name}（上${result.hu.upper}下${result.hu.lower}）— 卦辞：${result.huDict.panCi}`,
    `变卦：${result.bianDict.name}（上${result.bian.upper}下${result.bian.lower}）— 卦辞：${result.bianDict.panCi}`,
    `卦中卦：${result.guaZhongGua.name}（上${result.guaZhongGua.upper}下${result.guaZhongGua.lower}）`,
    `体卦：${result.tiYong.ti}　用卦：${result.tiYong.yong}　关系：${tiYongLine}`,
    `应期：${yingQiLine}`,
  ];

  if (result.timeEnergy) {
    userPromptLines.push(`时辰能量：${result.timeEnergy.summary}`);
  }
  userPromptLines.push(`五行损益：${result.sunYi.summary}`);

  // 6 维度 delta（仅取非 0 的）
  const nonZero = result.sunYi.adjustments.filter((a) => a.delta !== 0);
  if (nonZero.length > 0) {
    const adjLine = nonZero
      .map((a) => `${a.dim}${a.delta > 0 ? "+" : ""}${a.delta}`)
      .join("、");
    userPromptLines.push(`损益分布：${adjLine}`);
  }

  if (userQuestion) {
    userPromptLines.push("", `用户问的是：${userQuestion}`);
  }
  userPromptLines.push("", "请按上面 system prompt 的结构和字数要求解读。");

  return {
    systemPrompt,
    userPrompt: userPromptLines.join("\n"),
  };
}

/**
 * 6 爻线条美化（▬▬ 阳 / ▬ ▬ 阴），底→上读
 */
function formatLines(lines: ReadonlyArray<boolean>): string {
  const top = lines.slice().reverse();
  return top.map((y) => (y ? "▬▬" : "▬ ▬")).join(" ");
}
