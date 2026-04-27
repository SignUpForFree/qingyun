import type { BaziPillars } from "@/types/domain";
import type { Stem, Branch } from "./stems-branches";

/**
 * 30 神煞规则（M3.7，spec §5.5 核心 IP）
 *
 * 数据结构：每条 ShenshaRule 暴露 name + match(pillars) + interpretation + categories。
 * 调用方用 detectAllShensha(pillars) 一次性拿全部命中，然后挑相关 dim 渲染。
 *
 * 实现规模约定：30 条全列；match 函数尽量纯查表 + O(1)；不依赖大运/流年。
 *
 * 文献参考：spec §5.5；命理常识 - 协纪辨方书 - 三命通会 简化版（不区分宫位的子集）。
 *
 * 注意：传统神煞有"宫位限定"（如驿马必须在年支或日支），本简化版只查 4 柱地支
 * 整体集合，对 V2.0 解读够用，V2.1 迭代再加宫位精确度。
 */

import { mainHiddenStem } from "./stems-branches";

export type V2DivinationDim =
  | "综合运势"
  | "事业学业"
  | "财运"
  | "感情姻缘"
  | "人际贵人"
  | "平安健康";

export interface ShenshaRule {
  name: string;
  match: (pillars: BaziPillars) => boolean;
  interpretation: string;
  categories: readonly V2DivinationDim[];
  /** "吉" 神 / "凶" 煞 标签 — 用于 prompt 加权 */
  polarity: "吉" | "凶" | "中";
}

// ============ helpers ============

function allBranches(p: BaziPillars): Branch[] {
  return [p.year.zhi, p.month.zhi, p.day.zhi, p.hour.zhi];
}

function allStems(p: BaziPillars): Stem[] {
  return [p.year.gan, p.month.gan, p.day.gan, p.hour.gan];
}

function dayStem(p: BaziPillars): Stem {
  return p.day.gan;
}

function dayBranch(p: BaziPillars): Branch {
  return p.day.zhi;
}

function yearBranch(p: BaziPillars): Branch {
  return p.year.zhi;
}

function hasAny(target: readonly Branch[], pool: readonly Branch[]): boolean {
  return target.some((t) => pool.includes(t));
}

// ============ 30 规则 ============

/**
 * 1. 天乙贵人（吉，人际/事业）
 *  甲戊见丑未；乙己见子申；丙丁见亥酉；庚辛见寅午；壬癸见卯巳
 */
const TIANYI_TABLE: Record<Stem, readonly Branch[]> = {
  甲: ["丑", "未"],
  戊: ["丑", "未"],
  乙: ["子", "申"],
  己: ["子", "申"],
  丙: ["亥", "酉"],
  丁: ["亥", "酉"],
  庚: ["寅", "午"],
  辛: ["寅", "午"],
  壬: ["卯", "巳"],
  癸: ["卯", "巳"],
};

/**
 * 2. 文昌（吉，事业学业）
 *  甲见巳，乙见午，丙戊见申，丁己见酉，庚见亥，辛见子，壬见寅，癸见卯
 */
const WENCHANG_TABLE: Record<Stem, Branch> = {
  甲: "巳",
  乙: "午",
  丙: "申",
  戊: "申",
  丁: "酉",
  己: "酉",
  庚: "亥",
  辛: "子",
  壬: "寅",
  癸: "卯",
};

/**
 * 3. 桃花（中性，感情）
 *  申子辰见酉；亥卯未见子；寅午戌见卯；巳酉丑见午
 */
function taohuaBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "酉";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "子";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "卯";
  return "午"; // 巳酉丑
}

/**
 * 4. 驿马（中性，事业财运）
 *  申子辰见寅；亥卯未见巳；寅午戌见申；巳酉丑见亥
 */
function yimaBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "寅";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "巳";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "申";
  return "亥";
}

/**
 * 5. 华盖（中性，综合）
 *  申子辰见辰；亥卯未见未；寅午戌见戌；巳酉丑见丑
 */
function huagaiBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "辰";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "未";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "戌";
  return "丑";
}

/**
 * 6. 将星（吉，事业）
 *  申子辰见子；亥卯未见卯；寅午戌见午；巳酉丑见酉（每三合中位）
 */
function jiangxingBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "子";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "卯";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "午";
  return "酉";
}

/**
 * 7. 红鸾（吉，感情）
 *  子年见卯，丑年见寅，寅年见丑... 顺数到 9 位
 */
const HONGLUAN_TABLE: Record<Branch, Branch> = {
  子: "卯",
  丑: "寅",
  寅: "丑",
  卯: "子",
  辰: "亥",
  巳: "戌",
  午: "酉",
  未: "申",
  申: "未",
  酉: "午",
  戌: "巳",
  亥: "辰",
};

/**
 * 8. 天喜（吉，感情）
 *  子年见酉，丑年见申，寅年见未，卯年见午...（红鸾的对宫）
 */
const TIANXI_TABLE: Record<Branch, Branch> = {
  子: "酉",
  丑: "申",
  寅: "未",
  卯: "午",
  辰: "巳",
  巳: "辰",
  午: "卯",
  未: "寅",
  申: "丑",
  酉: "子",
  戌: "亥",
  亥: "戌",
};

/**
 * 9. 太极贵人（吉，综合）
 *  甲乙年/日见子午，丙丁见卯酉，戊己见辰戌丑未，庚辛见寅亥，壬癸见巳申
 */
const TAIJI_TABLE: Record<Stem, readonly Branch[]> = {
  甲: ["子", "午"],
  乙: ["子", "午"],
  丙: ["卯", "酉"],
  丁: ["卯", "酉"],
  戊: ["辰", "戌", "丑", "未"],
  己: ["辰", "戌", "丑", "未"],
  庚: ["寅", "亥"],
  辛: ["寅", "亥"],
  壬: ["巳", "申"],
  癸: ["巳", "申"],
};

/**
 * 10/11 天德 / 月德（吉，综合）— 月支决定
 *  寅月见丁；卯月见申；辰月见壬；巳月见辛；午月见亥；未月见甲；
 *  申月见癸；酉月见寅；戌月见丙；亥月见乙；子月见巳；丑月见庚
 */
const TIANDE_TABLE: Record<Branch, Stem | Branch> = {
  寅: "丁",
  卯: "申",
  辰: "壬",
  巳: "辛",
  午: "亥",
  未: "甲",
  申: "癸",
  酉: "寅",
  戌: "丙",
  亥: "乙",
  子: "巳",
  丑: "庚",
};

/**
 * 月德：寅午戌月见丙；申子辰月见壬；亥卯未月见甲；巳酉丑月见庚
 */
function yueDeStem(monthBranch: Branch): Stem {
  if (["寅", "午", "戌"].includes(monthBranch)) return "丙";
  if (["申", "子", "辰"].includes(monthBranch)) return "壬";
  if (["亥", "卯", "未"].includes(monthBranch)) return "甲";
  return "庚";
}

/**
 * 12. 学堂词馆（吉，事业学业）
 *  甲日逢亥；乙日逢午；丙戊日逢寅；丁己日逢酉；庚日逢巳；辛日逢子；壬日逢申；癸日逢卯
 */
const XUETANG_TABLE: Record<Stem, Branch> = {
  甲: "亥",
  乙: "午",
  丙: "寅",
  戊: "寅",
  丁: "酉",
  己: "酉",
  庚: "巳",
  辛: "子",
  壬: "申",
  癸: "卯",
};

/**
 * 13. 国印（吉，事业）
 *  甲见戌，乙见亥，丙见丑，丁见寅，戊见丑，己见寅，庚见辰，辛见巳，壬见未，癸见申
 */
const GUOYIN_TABLE: Record<Stem, Branch> = {
  甲: "戌",
  乙: "亥",
  丙: "丑",
  丁: "寅",
  戊: "丑",
  己: "寅",
  庚: "辰",
  辛: "巳",
  壬: "未",
  癸: "申",
};

/**
 * 14. 金舆（吉，财运感情）
 *  甲见辰，乙见巳，丙见未，丁见申，戊见未，己见申，庚见戌，辛见亥，壬见丑，癸见寅
 */
const JINYU_TABLE: Record<Stem, Branch> = {
  甲: "辰",
  乙: "巳",
  丙: "未",
  丁: "申",
  戊: "未",
  己: "申",
  庚: "戌",
  辛: "亥",
  壬: "丑",
  癸: "寅",
};

/**
 * 15. 福星贵人（吉，综合）
 *  甲见寅，乙见丑，丙见子，丁见酉，戊见申，己见未，庚见午，辛见巳，壬见辰，癸见卯
 */
const FUXING_TABLE: Record<Stem, Branch> = {
  甲: "寅",
  乙: "丑",
  丙: "子",
  丁: "酉",
  戊: "申",
  己: "未",
  庚: "午",
  辛: "巳",
  壬: "辰",
  癸: "卯",
};

/**
 * 16. 天医（吉，平安健康）
 *  寅月见丑，卯月见寅... 月支前一位
 */
function tianyiBranch(monthBranch: Branch): Branch {
  const order: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const i = order.indexOf(monthBranch);
  return order[(i - 1 + 12) % 12]!;
}

/**
 * 17. 三奇（吉，综合）
 *  天上三奇 甲戊庚 / 地下三奇 乙丙丁 / 人中三奇 壬癸辛
 *  4 柱天干含其中一组 3 个干就算
 */
function hasThreeQi(stems: Stem[]): boolean {
  const sets: ReadonlyArray<readonly Stem[]> = [
    ["甲", "戊", "庚"],
    ["乙", "丙", "丁"],
    ["壬", "癸", "辛"],
  ];
  for (const set of sets) {
    if (set.every((s) => stems.includes(s))) return true;
  }
  return false;
}

/**
 * 18. 禄神（吉，财运事业）
 *  甲禄在寅，乙禄在卯，丙戊禄在巳，丁己禄在午，庚禄在申，辛禄在酉，壬禄在亥，癸禄在子
 */
const LUSHEN_TABLE: Record<Stem, Branch> = {
  甲: "寅",
  乙: "卯",
  丙: "巳",
  戊: "巳",
  丁: "午",
  己: "午",
  庚: "申",
  辛: "酉",
  壬: "亥",
  癸: "子",
};

/**
 * 19. 羊刃（凶，平安健康）
 *  甲见卯，乙见辰，丙戊见午，丁己见未，庚见酉，辛见戌，壬见子，癸见丑
 */
const YANGREN_TABLE: Record<Stem, Branch> = {
  甲: "卯",
  乙: "辰",
  丙: "午",
  戊: "午",
  丁: "未",
  己: "未",
  庚: "酉",
  辛: "戌",
  壬: "子",
  癸: "丑",
};

/**
 * 20. 飞刃（凶，平安健康）— 羊刃对宫
 */
const FEIREN_TABLE: Record<Stem, Branch> = {
  甲: "酉",
  乙: "戌",
  丙: "子",
  戊: "子",
  丁: "丑",
  己: "丑",
  庚: "卯",
  辛: "辰",
  壬: "午",
  癸: "未",
};

/**
 * 21. 劫煞（凶，财运）
 *  申子辰见巳；亥卯未见申；寅午戌见亥；巳酉丑见寅
 */
function jieshaBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "巳";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "申";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "亥";
  return "寅";
}

/**
 * 22. 灾煞（凶，平安健康）
 *  申子辰见午；亥卯未见酉；寅午戌见子；巳酉丑见卯
 */
function zaishaBranch(yearOrDay: Branch): Branch {
  if (["申", "子", "辰"].includes(yearOrDay)) return "午";
  if (["亥", "卯", "未"].includes(yearOrDay)) return "酉";
  if (["寅", "午", "戌"].includes(yearOrDay)) return "子";
  return "卯";
}

/**
 * 23. 元辰（凶，感情）
 *  阳男阴女顺一位，阴男阳女逆一位（简化：取冲位前后位）
 *  这里简化为年支冲位的前一位
 */
function yuanchenBranch(yb: Branch): Branch {
  const chongMap: Record<Branch, Branch> = {
    子: "未",
    丑: "申",
    寅: "酉",
    卯: "戌",
    辰: "亥",
    巳: "子",
    午: "丑",
    未: "寅",
    申: "卯",
    酉: "辰",
    戌: "巳",
    亥: "午",
  };
  return chongMap[yb];
}

/**
 * 24. 孤辰寡宿（凶，感情）
 *  亥子丑年见寅为孤辰，见戌为寡宿
 *  寅卯辰年见巳孤，丑寡
 *  巳午未年见申孤，辰寡
 *  申酉戌年见亥孤，未寡
 */
function guchenBranch(yb: Branch): Branch {
  if (["亥", "子", "丑"].includes(yb)) return "寅";
  if (["寅", "卯", "辰"].includes(yb)) return "巳";
  if (["巳", "午", "未"].includes(yb)) return "申";
  return "亥";
}

function guasuBranch(yb: Branch): Branch {
  if (["亥", "子", "丑"].includes(yb)) return "戌";
  if (["寅", "卯", "辰"].includes(yb)) return "丑";
  if (["巳", "午", "未"].includes(yb)) return "辰";
  return "未";
}

/**
 * 25. 阴阳差错（凶，感情）
 *  日柱为 丙子/丁丑/戊寅/辛卯/壬辰/癸巳/丙午/丁未/戊申/辛酉/壬戌/癸亥
 */
const YINYANG_CHACUO_DAY: ReadonlySet<string> = new Set([
  "丙子",
  "丁丑",
  "戊寅",
  "辛卯",
  "壬辰",
  "癸巳",
  "丙午",
  "丁未",
  "戊申",
  "辛酉",
  "壬戌",
  "癸亥",
]);

/**
 * 26. 童子煞（凶，平安健康）— 简化：年支为子卯午酉者命带
 */
function isTongziYear(yb: Branch): boolean {
  return ["子", "卯", "午", "酉"].includes(yb);
}

/**
 * 27. 流霞（凶，平安健康）
 *  甲日见酉，乙日见戌，丙日见未，丁日见申，戊日见巳，己日见午，
 *  庚日见辰，辛日见卯，壬日见亥，癸日见寅
 */
const LIUXIA_TABLE: Record<Stem, Branch> = {
  甲: "酉",
  乙: "戌",
  丙: "未",
  丁: "申",
  戊: "巳",
  己: "午",
  庚: "辰",
  辛: "卯",
  壬: "亥",
  癸: "寅",
};

/**
 * 28. 亡神（凶，综合）
 *  申子辰见亥；亥卯未见寅；寅午戌见巳；巳酉丑见申
 */
function wangshenBranch(yb: Branch): Branch {
  if (["申", "子", "辰"].includes(yb)) return "亥";
  if (["亥", "卯", "未"].includes(yb)) return "寅";
  if (["寅", "午", "戌"].includes(yb)) return "巳";
  return "申";
}

/**
 * 29. 隔角（凶，人际）
 *  寅日见巳，卯日见辰... 简化：日支跳一位
 */
function gejiaoBranch(db: Branch): Branch {
  const order: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const i = order.indexOf(db);
  return order[(i + 3) % 12]!;
}

/**
 * 30. 十恶大败日（凶，财运）
 *  日柱为 甲辰/乙巳/丙申/丁亥/戊戌/己丑/庚辰/辛巳/壬申/癸亥（共 10 个）
 */
const SHIE_DABAI_DAYS: ReadonlySet<string> = new Set([
  "甲辰",
  "乙巳",
  "丙申",
  "丁亥",
  "戊戌",
  "己丑",
  "庚辰",
  "辛巳",
  "壬申",
  "癸亥",
]);

// ============ 规则注册 ============

export const SHENSHA_RULES: readonly ShenshaRule[] = [
  {
    name: "天乙贵人",
    polarity: "吉",
    interpretation: "一生易得贵人提携，逢凶化吉的能力强",
    categories: ["人际贵人", "事业学业"],
    match: (p) => hasAny(TIANYI_TABLE[dayStem(p)], allBranches(p)),
  },
  {
    name: "文昌",
    polarity: "吉",
    interpretation: "聪慧好学，写作考试有助力，适合走专业路线",
    categories: ["事业学业"],
    match: (p) => allBranches(p).includes(WENCHANG_TABLE[dayStem(p)]),
  },
  {
    name: "桃花",
    polarity: "中",
    interpretation: "异性缘旺，社交亲和，注意分清正缘与浮缘",
    categories: ["感情姻缘", "人际贵人"],
    match: (p) => allBranches(p).includes(taohuaBranch(yearBranch(p))),
  },
  {
    name: "驿马",
    polarity: "中",
    interpretation: "动态机遇多，常有出差/搬迁/远游契机",
    categories: ["事业学业", "财运"],
    match: (p) =>
      allBranches(p).includes(yimaBranch(yearBranch(p))) ||
      allBranches(p).includes(yimaBranch(dayBranch(p))),
  },
  {
    name: "华盖",
    polarity: "中",
    interpretation: "心智独立，对玄学/艺术/哲学敏感，宜深度学习",
    categories: ["综合运势", "事业学业"],
    match: (p) => allBranches(p).includes(huagaiBranch(yearBranch(p))),
  },
  {
    name: "将星",
    polarity: "吉",
    interpretation: "有领导才干，三十岁后渐入佳境",
    categories: ["事业学业"],
    match: (p) => allBranches(p).includes(jiangxingBranch(yearBranch(p))),
  },
  {
    name: "红鸾",
    polarity: "吉",
    interpretation: "感情运旺，遇姻缘机会，宜把握",
    categories: ["感情姻缘"],
    match: (p) => allBranches(p).includes(HONGLUAN_TABLE[yearBranch(p)]),
  },
  {
    name: "天喜",
    polarity: "吉",
    interpretation: "喜庆事多，添喜进财；适合谈感情/嫁娶",
    categories: ["感情姻缘", "综合运势"],
    match: (p) => allBranches(p).includes(TIANXI_TABLE[yearBranch(p)]),
  },
  {
    name: "太极贵人",
    polarity: "吉",
    interpretation: "悟性高，对玄学命理敏感，能化解日常烦扰",
    categories: ["综合运势", "人际贵人"],
    match: (p) => hasAny(TAIJI_TABLE[dayStem(p)], allBranches(p)),
  },
  {
    name: "天德",
    polarity: "吉",
    interpretation: "得天助，一生少灾多福",
    categories: ["综合运势", "平安健康"],
    match: (p) => {
      const target = TIANDE_TABLE[p.month.zhi];
      return allStems(p).includes(target as Stem) || allBranches(p).includes(target as Branch);
    },
  },
  {
    name: "月德",
    polarity: "吉",
    interpretation: "月令护持，性情温和，多获亲友贴心相助",
    categories: ["综合运势", "人际贵人"],
    match: (p) => allStems(p).includes(yueDeStem(p.month.zhi)),
  },
  {
    name: "学堂",
    polarity: "吉",
    interpretation: "天生学霸气质，适合走专业 / 学术路线",
    categories: ["事业学业"],
    match: (p) => allBranches(p).includes(XUETANG_TABLE[dayStem(p)]),
  },
  {
    name: "国印",
    polarity: "吉",
    interpretation: "宜公职 / 体制内发展，担当能力突出",
    categories: ["事业学业"],
    match: (p) => allBranches(p).includes(GUOYIN_TABLE[dayStem(p)]),
  },
  {
    name: "金舆",
    polarity: "吉",
    interpretation: "婚姻得力 + 财气进门，配偶有助",
    categories: ["感情姻缘", "财运"],
    match: (p) => allBranches(p).includes(JINYU_TABLE[dayStem(p)]),
  },
  {
    name: "福星",
    polarity: "吉",
    interpretation: "福气深厚，逢难自有缓",
    categories: ["综合运势"],
    match: (p) => allBranches(p).includes(FUXING_TABLE[dayStem(p)]),
  },
  {
    name: "天医",
    polarity: "吉",
    interpretation: "健康调理力强，与医药 / 心理疗愈有缘",
    categories: ["平安健康"],
    match: (p) => allBranches(p).includes(tianyiBranch(p.month.zhi)),
  },
  {
    name: "三奇",
    polarity: "吉",
    interpretation: "格局奇特，常有非常人所及的机遇",
    categories: ["综合运势", "事业学业"],
    match: (p) => hasThreeQi(allStems(p)),
  },
  {
    name: "禄神",
    polarity: "吉",
    interpretation: "正财稳，工作收入有底气",
    categories: ["财运", "事业学业"],
    match: (p) => allBranches(p).includes(LUSHEN_TABLE[dayStem(p)]),
  },
  {
    name: "羊刃",
    polarity: "凶",
    interpretation: "锋芒过盛，易冲动 / 意外伤；行事先稳",
    categories: ["平安健康", "人际贵人"],
    match: (p) => allBranches(p).includes(YANGREN_TABLE[dayStem(p)]),
  },
  {
    name: "飞刃",
    polarity: "凶",
    interpretation: "突发风险信号，注意安全 / 言辞",
    categories: ["平安健康"],
    match: (p) => allBranches(p).includes(FEIREN_TABLE[dayStem(p)]),
  },
  {
    name: "劫煞",
    polarity: "凶",
    interpretation: "有破财 / 是非，理财避免冲动消费",
    categories: ["财运"],
    match: (p) => allBranches(p).includes(jieshaBranch(yearBranch(p))),
  },
  {
    name: "灾煞",
    polarity: "凶",
    interpretation: "意外烦扰，注意身体小毛病早治",
    categories: ["平安健康"],
    match: (p) => allBranches(p).includes(zaishaBranch(yearBranch(p))),
  },
  {
    name: "元辰",
    polarity: "凶",
    interpretation: "心思易钻牛角尖，感情有起伏",
    categories: ["感情姻缘", "综合运势"],
    match: (p) => allBranches(p).includes(yuanchenBranch(yearBranch(p))),
  },
  {
    name: "孤辰",
    polarity: "凶",
    interpretation: "情感容易冷淡 / 距离感，耐心经营",
    categories: ["感情姻缘"],
    match: (p) => allBranches(p).includes(guchenBranch(yearBranch(p))),
  },
  {
    name: "寡宿",
    polarity: "凶",
    interpretation: "感情独处倾向，需主动维系",
    categories: ["感情姻缘"],
    match: (p) => allBranches(p).includes(guasuBranch(yearBranch(p))),
  },
  {
    name: "阴阳差错",
    polarity: "凶",
    interpretation: "婚配易遇波折，中年前感情多反复",
    categories: ["感情姻缘"],
    match: (p) => YINYANG_CHACUO_DAY.has(`${p.day.gan}${p.day.zhi}`),
  },
  {
    name: "童子煞",
    polarity: "凶",
    interpretation: "小时易病弱，宜多关注身心调和",
    categories: ["平安健康"],
    match: (p) => isTongziYear(yearBranch(p)),
  },
  {
    name: "流霞",
    polarity: "凶",
    interpretation: "外伤 / 意外信号，开车 / 运动注意",
    categories: ["平安健康"],
    match: (p) => allBranches(p).includes(LIUXIA_TABLE[dayStem(p)]),
  },
  {
    name: "亡神",
    polarity: "凶",
    interpretation: "心力易耗 / 怅然，宜静养沉淀",
    categories: ["综合运势", "平安健康"],
    match: (p) => allBranches(p).includes(wangshenBranch(yearBranch(p))),
  },
  {
    name: "隔角",
    polarity: "凶",
    interpretation: "亲族 / 同事易疏离，沟通要主动",
    categories: ["人际贵人"],
    match: (p) => allBranches(p).includes(gejiaoBranch(dayBranch(p))),
  },
  {
    name: "十恶大败",
    polarity: "凶",
    interpretation: "投资易折，求稳为上",
    categories: ["财运"],
    match: (p) => SHIE_DABAI_DAYS.has(`${p.day.gan}${p.day.zhi}`),
  },
];

export function matchShensha(name: string, pillars: BaziPillars): boolean {
  return SHENSHA_RULES.find((r) => r.name === name)?.match(pillars) ?? false;
}

export function detectAllShensha(pillars: BaziPillars): readonly ShenshaRule[] {
  return SHENSHA_RULES.filter((r) => r.match(pillars));
}

/**
 * 按维度过滤神煞（用于解读 prompt 拼接）
 */
export function detectShenshaByDim(
  pillars: BaziPillars,
  dim: V2DivinationDim,
): readonly ShenshaRule[] {
  return detectAllShensha(pillars).filter((r) => r.categories.includes(dim));
}

// 让 mainHiddenStem 不被 shaking-tree 移除（其他模块还会用）
void mainHiddenStem;
