import "server-only";
import type { MeihuaV2Result } from "@/lib/divination/meihua-v2";
import { TRIGRAM_WUXING } from "@/lib/meihua/trigrams";
import type { Wuxing } from "@/lib/bazi/stems-branches";

/**
 * 梅花易数 V2 解读 prompt（测算结果解读 · 五段结构）
 *
 * 输出结构由 SYSTEM_BASE 定义；userPrompt 注入起卦数据、卦辞、体用、应期等素材。
 */

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 测算时间展示：当前公历（UTC+8） */
export function formatGregorianDateTime(date: Date = new Date()): string {
  const d = new Date(date.getTime() + UTC8_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const h = d.getUTCHours().toString().padStart(2, "0");
  const min = d.getUTCMinutes().toString().padStart(2, "0");
  return `${y}年${m}月${day}日 ${h}:${min}`;
}

const SYSTEM_BASE = `将模版中所有 {{占位}} 替换为素材中的真实内容；不要保留花括号，不要输出模版说明文字或自检清单原文。

# 人设：
你是一位精通《周易》智慧与梅花易数推演的玄学顾问，擅长用现代、平实且富有文学美感的语言，为用户解读卦象。

# 测算结果解读
测算时间：{{当前公历时间}}
测算事由：{{用户输入}}
起卦方式：数字起卦（{{数字1}}, {{数字2}}, {{数字3}}）

## 一、测算溯源 · 象数推演
### 本卦 · {{本卦卦名}}（䷶）  主兆当下之事
上卦：{{上卦象}}（{{上卦五行}}）     下卦：{{下卦象}}（{{下卦五行}}）
卦辞原文："{{本卦卦辞}}"
卦辞释义：{{控制在80-100字，结合求问事由进行隐喻解读，要求直白易懂}}

### 互卦 · {{互卦卦名}}（䷰）  兆示发展之过程
上互卦：{{互卦上卦象}}（{{互卦上卦五行}}）   下互卦：{{互卦下卦象}}（{{互卦下卦五行}}）
卦辞原文："{{互卦卦辞}}"
过程揭示：{{控制在80-100字，结合用户所求之事及卦象信息点出隐藏的矛盾、转机与需要警惕的假象，要求直白易懂}}

### 变卦 · {{变卦卦名}}（䷍）  兆明最终之结果
上卦：{{变卦上卦象}}（{{变卦上卦五行}}）    下卦：{{变卦下卦象}}（{{变卦下卦五行}}）
卦辞原文："{{变卦卦辞}}"
结果预示：{{控制在80-100字，结合用户所求之事及卦象信息给出场景化的终局指引，要求直白易懂}}

## 二、体用生克 · 成败枢机
-基于体用生克的角度进行分析卦象，给出体卦、变卦、变用卦的状况

## 三、卦象详解 · 玄机洞明
基于上述中对本卦、互卦、变卦的整体卦象结合用户所求之事（或遇到的问题）进行详细的解读说明，包括事态的演化（从本卦、互卦、变卦），帮助用户洞见玄机。控制在300-500字

## 四、核心结论：
{{用一两句话对整体卦象进行总结提炼}}


## 五、建议指引
{{基于卦象和所求之事给出用户相关建议}}

## 输出的内容要求：

-所有解读部分必须使用流畅优美且直白的中文，让人感觉辞藻优美又直白易懂。
- 杜绝绝对化的吉凶断言，多用"如……般""恰似""提示""宜""慎"等柔和而有力的指引语。
- 对克害之象，务必转化为"淬炼""提醒""积蓄"等正向动力。不应使用恐吓或宿命化表达。

## 输出的内容结构要求：
### 你必须严格遵守Markdown排版规范：
-注意标题层级的格式和加粗
-重点的地方和标题进行加粗
### 段落与换行：
-段落之间必须空一行（即两个换行符）。
-每个段落内部文字正常换行，但不要手动断句换行（让文本自然流动）。


## 最终输出前自检清单
-是否完全避免了"大吉"、"大凶"、"注定"等词汇？
-所有的克、难，是否都转化为了"提醒"、"淬炼"、"积蓄"？
-每个部分的解读，是否都结合了用户输入的问题及所求之事？
-语言是否做到了"辞藻优美"但"一听就懂"？
-格式上，标题、段落、加粗是否清晰易读？
-是否去掉和修正了无用的信息内容和标点符号，形成一个结构清晰易读，无半点干扰，该字体加粗或突出的则突出，该分段段则分段`;

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
  /**
   * 测算时间展示文本（公历）。
   * 未传时默认 formatGregorianDateTime()。
   * @deprecated 请用 measuredAtText；lunarDateText 仍兼容
   */
  lunarDateText?: string;
  measuredAtText?: string;
}

export interface BuildMeihuaPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildMeihuaPrompt(args: BuildMeihuaPromptArgs): BuildMeihuaPromptResult {
  const { result, userQuestion, numbers } = args;
  const measuredAt =
    args.measuredAtText ?? args.lunarDateText ?? formatGregorianDateTime();

  const focusSuffix = userQuestion
    ? `\n本次围绕用户问题：【${userQuestion}】，全文解读须紧扣此事。`
    : "";

  const systemPrompt = SYSTEM_BASE + focusSuffix;

  const linesArt = formatLines(result.ben.lines);
  const tiYongLine = TIYONG_LABEL[result.tiYong.relation] ?? result.tiYong.relation;
  const yingQiLine = YINGQI_LABEL[result.yingQi.speed] ?? result.yingQi.speed;

  const tiWuxing = TRIGRAM_WUXING[result.tiYong.ti] as Wuxing;
  const yongWuxing = TRIGRAM_WUXING[result.tiYong.yong] as Wuxing;
  const bianYongWuxing = TRIGRAM_WUXING[result.bianTiYong.bianYong] as Wuxing;

  const benUpperWuxing = TRIGRAM_WUXING[result.ben.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const benLowerWuxing = TRIGRAM_WUXING[result.ben.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const huUpperWuxing = TRIGRAM_WUXING[result.hu.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const huLowerWuxing = TRIGRAM_WUXING[result.hu.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const bianUpperWuxing = TRIGRAM_WUXING[result.bian.upper as keyof typeof TRIGRAM_WUXING] as Wuxing;
  const bianLowerWuxing = TRIGRAM_WUXING[result.bian.lower as keyof typeof TRIGRAM_WUXING] as Wuxing;

  const bianTiYongLine = TIYONG_LABEL[result.bianTiYong.relation] ?? result.bianTiYong.relation;

  const numList = numbers ?? [];
  const methodDesc =
    result.method === "time"
      ? "时间起卦"
      : `数字起卦（${numList.join("、")}）`;

  const n1 = numList[0] ?? "—";
  const n2 = numList[1] ?? "—";
  const n3 = numList[2] ?? "—";

  const userPromptLines: string[] = [
    "【重要】严格按 system 模版输出完整《测算结果解读》，保留全部章节与 Markdown 标题层级。",
    "- 文首须含：# 测算结果解读、测算时间、测算事由、起卦方式（用下方对应值）。",
    "- 第二节：从体用生克角度分析，写清体卦、变卦（整卦态势）、变用卦的状况（依据【体用生克素材】）。",
    "- 第三节：一段 300-500 字连贯解读，写清本卦→互卦→变卦的事态演化，紧扣所求之事。",
    "- 内化自检清单后再定稿，勿把清单抄进正文。",
    "",
    `【当前公历时间】${measuredAt}`,
    `【用户输入 / 测算事由】${userQuestion ?? "未指定"}`,
    `【起卦方式】${methodDesc}`,
    `【数字1】${n1}　【数字2】${n2}　【数字3】${n3}`,
    "",
    "===== 一、象数推演素材 =====",
    `本卦卦名：${result.benDict.name}（上${result.ben.upper}下${result.ben.lower}）${linesArt}`,
    `本卦上卦象：${result.ben.upper}（${benUpperWuxing}）　下卦象：${result.ben.lower}（${benLowerWuxing}）`,
    `本卦卦辞：${result.benDict.panCi}`,
    `本卦彖辞：${result.benDict.tuanCi}`,
    `本卦大象传：${result.benDict.daXiang}`,
    `动爻：第 ${result.dongYao} 爻 — ${result.benDict.dongYaoCi ?? "（无）"}`,
    `互卦卦名：${result.huDict.name}（上${result.hu.upper}下${result.hu.lower}）`,
    `互卦上卦象：${result.hu.upper}（${huUpperWuxing}）　下卦象：${result.hu.lower}（${huLowerWuxing}）`,
    `互卦卦辞：${result.huDict.panCi}`,
    `互卦彖辞：${result.huDict.tuanCi}`,
    `互卦大象传：${result.huDict.daXiang}`,
    `变卦卦名：${result.bianDict.name}（上${result.bian.upper}下${result.bian.lower}）`,
    `变卦上卦象：${result.bian.upper}（${bianUpperWuxing}）　下卦象：${result.bian.lower}（${bianLowerWuxing}）`,
    `变卦卦辞：${result.bianDict.panCi}`,
    `变卦彖辞：${result.bianDict.tuanCi}`,
    `变卦大象传：${result.bianDict.daXiang}`,
    "",
    "===== 二、体用生克素材（填入第二节）=====",
    `体卦象：${result.tiYong.ti}（${tiWuxing}）　本卦体用关系：${tiYongLine}`,
    `用卦象：${result.tiYong.yong}（${yongWuxing}）`,
    `变卦：${result.bianDict.name}（上${result.bian.upper}下${result.bian.lower}）`,
    `变用卦象：${result.bianTiYong.bianYong}（${bianYongWuxing}）　变卦体用关系：${bianTiYongLine}`,
    "",
    "===== 三、卦象详解参考（第三节 300-500 字须用上）=====",
    `本卦六爻爻辞：${formatYaoCi(result.benDict.yaoCi)}`,
    `互卦六爻爻辞：${formatYaoCi(result.huDict.yaoCi)}`,
    `变卦六爻爻辞：${formatYaoCi(result.bianDict.yaoCi)}`,
    "",
    "===== 辅助素材 =====",
    `应期：${yingQiLine}（${result.yingQi.timeHint}）`,
  ];

  if (result.timeEnergy) {
    userPromptLines.push(`时辰能量：${result.timeEnergy.summary}`);
  }
  userPromptLines.push(`五行损益：${result.sunYi.summary}`);

  const nonZero = result.sunYi.adjustments.filter((a) => a.delta !== 0);
  if (nonZero.length > 0) {
    const adjLine = nonZero
      .map((a) => `${a.dim}${a.delta > 0 ? "+" : ""}${a.delta}`)
      .join("、");
    userPromptLines.push(`损益分布：${adjLine}`);
  }

  if (userQuestion) {
    userPromptLines.push("", `【再次强调所求之事】${userQuestion}`);
  }
  userPromptLines.push(
    "",
    "请严格按 system 模版撰写完整《测算结果解读》，代入以上素材，勿遗漏任何章节。",
  );

  return {
    systemPrompt,
    userPrompt: userPromptLines.join("\n"),
  };
}

function formatLines(lines: ReadonlyArray<boolean>): string {
  const top = lines.slice().reverse();
  return top.map((y) => (y ? "▬▬" : "▬ ▬")).join(" ");
}

function formatYaoCi(yaoCi: ReadonlyArray<string>): string {
  if (!yaoCi || yaoCi.length === 0) return "（无）";
  return yaoCi.filter(Boolean).join(" / ") || "（无）";
}
