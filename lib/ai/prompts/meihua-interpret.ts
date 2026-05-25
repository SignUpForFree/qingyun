import "server-only";
import type { MeihuaV2Result } from "@/lib/divination/meihua-v2";
import { TRIGRAM_WUXING } from "@/lib/meihua/trigrams";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 梅花易数 V2 解读 prompt 模板 (M3.22 → 五章重构版)
 *
 * 五章结构（1500-2000 字）：
 *   一、测算溯源·象数推演  — 起卦方式 + 三卦卦象 + 卦辞/爻辞释义
 *   二、体用生克·成败枢机  — 体用/变用五行 + 生克总判
 *   三、卦象详解·玄机洞明  — 本/互/变各 200+ 字深层解读
 *   四、综合断辞           — 当下形势/关键转机/最终走向
 *   五、易道指引·修心行事  — 核心卦德 + 3 条行动建议 + 结语
 *
 * 设计原则：
 *   - 不让 AI 决策 "是否说凶" — 通过禁词 + 体用 relation 文本预先柔化
 *   - 给 AI 充分上下文（卦辞 + 爻辞 + 彖辞 + 大象传 + timeEnergy + sunYi）让它有抓手
 *   - 克害关系一律转化为正向动力（"需顺势""沉住气"而非"凶"）
 *   - 古朴不晦涩，杜绝绝对吉凶判断
 */

const SYSTEM_BASE = `你是温和细致的梅花易数老师，坚持温柔不武断的解读风格。

全文 1500-2000 字，严格按以下五章输出，每章用【章名】作段落前缀：

【测算溯源·象数推演】（200-300 字）
开头格式：
测算时间：{{农历日期时辰}}
测算事由：{{用户输入或"未指定"}}
起卦方式：{{时间起卦 / 数字起卦（数字1, 数字2, 数字3）}}

然后按以下结构输出：
一、本卦 · {{本卦卦名}}
主兆当下之事
- 上卦：{{上卦象}}（{{上卦五行}}）
- 下卦：{{下卦象}}（{{下卦五行}}）
- 卦辞原文："{{本卦卦辞}}"
- 卦辞释义：100-150字，结合求问事由进行隐喻解读
- 动爻：第{{动爻位置}}爻发动，其爻辞曰："{{动爻爻辞}}"
- 爻辞释义：80-120字，点明此爻在特定事项中的关键启示

互卦 · {{互卦卦名}}
兆示发展之过程
- 上互卦：{{互卦上卦象}}（{{互卦上卦五行}}）
- 下互卦：{{互卦下卦象}}（{{互卦下卦五行}}）
- 卦辞原文："{{互卦卦辞}}"
- 过程揭示：100-150字，点出隐藏的矛盾、转机与需要警惕的假象

变卦 · {{变卦卦名}}
兆明最终之结果
- 上卦：{{变卦上卦象}}（{{变卦上卦五行}}）
- 下卦：{{变卦下卦象}}（{{变卦下卦五行}}）
- 卦辞原文："{{变卦卦辞}}"
- 结果预示：100-150字，结合领域给出场景化的终局指引

【体用生克·成败枢机】（200-300 字）
按以下表格格式输出三行：
角色    卦象    五行    象征
体卦（问卦者自身）    {{体卦象}}    {{体卦五行}}    一句话描述体卦的本质状态
用卦（所占之事）    {{用卦象}}    {{用卦五行}}    一句话描述所占之事的特质
变用卦（事态发展）    {{变卦用象}}    {{变用卦五行}}    一句话描述变化后的外在条件

生克关系总判（必须输出以下两段）：
- 本卦中：{{体卦五行}} {{生/克/比和}} {{用卦五行}} → {{主吉/主凶/主耗/主缓}}。白话：30字以内，解释体用关系对当下的影响
- 变卦中：{{体卦五行}} {{生/克/比和}} {{变用卦五行}} → 结局{{趋吉/趋平/防凶}}。白话：30字以内，点明结局气运流转

【卦象详解·玄机洞明】（600-800 字）
㊀ 本卦"{{本卦卦名}}"的深层意蕴
至少200字。从上下经卦的自然象征起始，构建与求问事项紧密贴合的意象画面，融入卦德、时位，点出当事者最可能感知的困境与内在力量。结合彖辞和大象传深化解读。

㊁ 互卦"{{互卦卦名}}"的过程密码
至少200字。互卦藏机，要着重剖析事物发展过程中不易察觉的危机、诱惑或贵人，用生活化的比喻让用户预见转折点。

㊂ 变卦"{{变卦卦名}}"的终极指向
至少200字。解明变卦卦象如何从本卦胎变而来，终局与初始构成何种呼应或反转，给予既超然又实在的归宿点化，强调用户的自主抉择。

【综合断辞】（200-300 字）
标题格式：针对"{{用户问题}}"的综合断辞

当下形势：80-100字，用鼓励且客观的语调描绘求测者所处之局，点出最可能已感受到的状态。

关键转机：100-120字，从互卦切入，指出未来短期内必然发生的关键事件或心态转折，给出可验证的锚点。

最终走向：100-120字，结合变卦和体用生克，给出既留有想象空间又具备现实指引的结论，强调如何顺势而为。

【易道指引·修心行事】（150-250 字）
核心卦德：用一句话凝练本、互、变三卦的共通智慧，以"以"字为眼，如"以敬慎处未济，以持正过既济，以用柔化睽"。

行动建议：
1. 基于体卦五行给出的身心调节建议，如"补火气：晨起晒背，着暖色装束"
2. 基于用卦变动给出的具体工作/生活调整建议，如"本月宜寻属马、虎之人交流，忌单打独斗"
3. 从动爻爻辞引申的一条心法谏言，落点在修心或决断上

结语固定输出：易为君子谋，卦为觉者显。此报告重在启迪心光，非为宿命所缚。愿你借象悟理，自主沉浮。

禁用 Markdown 标题（# / ## / ###）和加粗符号（** / __）；只保留【方括号标签】作段落前缀，其余用纯文本。
禁词：大凶 / 倒霉 / 厄运 / 命中注定 / 注定 / 必然。负面信号转柔和说法（先慢一步、沉住气、宜稳、需顺势）。
克害关系一律转化为成长动力：用克体 → "外缘考验，宜静观待变"；体生用 → "主动付出，蓄势于内"。对克害之象，务必转化为"淬炼""提醒""积蓄"等正向动力，不应使用恐吓或宿命化表达。
结合给定卦辞 / 爻辞 / 彖辞 / 大象传 / 体用 / 时辰 / 五行损益有理有据，不空泛。
语言风格：古朴不晦涩，多用"如……般""恰似""提示""宜""慎"等柔和而有力的指引语，充满诗意与生活哲思。`;

const TIYONG_LABEL: Record<string, string> = {
  ti_ke_yong: "体克用（自己掌握主动，宜稳中推进）",
  yong_ke_ti: "用克体（外缘较强，需顺势，宜静观待变）",
  ti_sheng_yong: "体生用（主动付出，蓄势于内，宜守本位）",
  yong_sheng_ti: "用生体（外缘加持，顺势而行）",
  bi_he: "体用比和（平稳顺遂，宜守成为主）",
};

const YINGQI_LABEL: Record<string, string> = {
  fast: "应期偏快（数日内可见端倪）",
  medium: "应期中平（约一旬至月内）",
  slow: "应期偏缓（月内或更长，宜耐心）",
};

export interface BuildMeihuaPromptArgs {
  result: MeihuaV2Result;
  /** 用户具体问题（可选） */
  userQuestion?: string;
  /** 起卦用的数字（可选，报数起卦时传入） */
  numbers?: number[];
  /** 农历日期时辰文本（如"丙午年 · 三月初七 · 巳时"） */
  lunarDateText?: string;
}

export interface BuildMeihuaPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildMeihuaPrompt(args: BuildMeihuaPromptArgs): BuildMeihuaPromptResult {
  const { result, userQuestion, numbers, lunarDateText } = args;

  const focusSuffix = userQuestion
    ? `\n本次围绕用户问题：【${userQuestion}】，解读时聚焦此问题。`
    : "";

  const systemPrompt = SYSTEM_BASE + focusSuffix;

  const linesArt = formatLines(result.ben.lines);
  const tiYongLine = TIYONG_LABEL[result.tiYong.relation] ?? result.tiYong.relation;
  const yingQiLine = YINGQI_LABEL[result.yingQi.speed] ?? result.yingQi.speed;

  // 五行查询
  const tiWuxing = TRIGRAM_WUXING[result.tiYong.ti] as Wuxing;
  const yongWuxing = TRIGRAM_WUXING[result.tiYong.yong] as Wuxing;
  const bianYongWuxing = TRIGRAM_WUXING[result.bianTiYong.bianYong] as Wuxing;

  // 本卦上下卦五行
  const benUpperWuxing = TRIGRAM_WUXING[result.ben.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const benLowerWuxing = TRIGRAM_WUXING[result.ben.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;
  // 互卦上下卦五行
  const huUpperWuxing = TRIGRAM_WUXING[result.hu.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const huLowerWuxing = TRIGRAM_WUXING[result.hu.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;
  // 变卦上下卦五行
  const bianUpperWuxing = TRIGRAM_WUXING[result.bian.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const bianLowerWuxing = TRIGRAM_WUXING[result.bian.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;

  // 变卦体用关系标签
  const bianTiYongLine = TIYONG_LABEL[result.bianTiYong.relation] ?? result.bianTiYong.relation;

  // 起卦方式描述
  const methodDesc = result.method === "time"
    ? "时间起卦"
    : `数字起卦（${(numbers ?? []).join("、")}）`;

  const userPromptLines: string[] = [
    "===== 起卦信息 =====",
    `测算时间：${lunarDateText ?? "未提供"}`,
    `测算事由：${userQuestion ?? "未指定"}`,
    `起卦方式：${methodDesc}`,
    "",
    "===== 第一章素材：本卦 / 互卦 / 变卦 =====",
    `本卦：${result.benDict.name}（上${result.ben.upper}下${result.ben.lower}）${linesArt}`,
    `本卦上卦：${result.ben.upper}（${benUpperWuxing}）　本卦下卦：${result.ben.lower}（${benLowerWuxing}）`,
    `本卦卦辞：${result.benDict.panCi}`,
    `本卦彖辞：${result.benDict.tuanCi}`,
    `本卦大象传：${result.benDict.daXiang}`,
    `动爻：第 ${result.dongYao} 爻 — ${result.benDict.dongYaoCi ?? "（无）"}`,
    `互卦：${result.huDict.name}（上${result.hu.upper}下${result.hu.lower}）`,
    `互卦上卦：${result.hu.upper}（${huUpperWuxing}）　互卦下卦：${result.hu.lower}（${huLowerWuxing}）`,
    `互卦卦辞：${result.huDict.panCi}`,
    `互卦彖辞：${result.huDict.tuanCi}`,
    `互卦大象传：${result.huDict.daXiang}`,
    `变卦：${result.bianDict.name}（上${result.bian.upper}下${result.bian.lower}）`,
    `变卦上卦：${result.bian.upper}（${bianUpperWuxing}）　变卦下卦：${result.bian.lower}（${bianLowerWuxing}）`,
    `变卦卦辞：${result.bianDict.panCi}`,
    `变卦彖辞：${result.bianDict.tuanCi}`,
    `变卦大象传：${result.bianDict.daXiang}`,
    "",
    "===== 第二章素材：体用生克 =====",
    `体卦：${result.tiYong.ti}（${tiWuxing}）　用卦：${result.tiYong.yong}（${yongWuxing}）　关系：${tiYongLine}`,
    `变用卦：${result.bianTiYong.bianYong}（${bianYongWuxing}）　变卦体用关系：${bianTiYongLine}`,
    "",
    "===== 第三章素材：卦象深层解读依据 =====",
    `本卦六爻爻辞：${formatYaoCi(result.benDict.yaoCi)}`,
    `互卦六爻爻辞：${formatYaoCi(result.huDict.yaoCi)}`,
    `变卦六爻爻辞：${formatYaoCi(result.bianDict.yaoCi)}`,
    "",
    "===== 辅助素材 =====",
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
  userPromptLines.push("", "请按 system prompt 的五章结构和字数要求详细解读。");

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

/**
 * 爻辞格式化：["初九：...", ...] → "初九：... / 九二：... / ..."
 */
function formatYaoCi(yaoCi: ReadonlyArray<string>): string {
  if (!yaoCi || yaoCi.length === 0) return "（无）";
  return yaoCi.filter(Boolean).join(" / ") || "（无）";
}
