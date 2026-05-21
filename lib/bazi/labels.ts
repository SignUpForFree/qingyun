/**
 * 六大维度标签生成 + 运势等级判定
 */

import type { BaziPillars } from "@/types/domain";
import type { Wuxing, TenGod, Stem, Branch } from "./stems-branches";
import { wuxingOf, tenGod, tenGodCamp, HIDDEN_STEMS_DETAILED } from "./stems-branches";
import type { StrengthType, TemporaryFortuneResult } from "./engine";

// ── 运势等级 ─────────────────────────────────────────────────────

export type FortuneLevel = "大吉" | "吉" | "平" | "凶" | "大凶";

/**
 * 大运/流年运势等级判定（§11 需求）
 *
 * R = G/(G+J)，按 R 值阈值划分5级运势。
 * bangfu_total / kexiehao_total 来自临时命局完整重算（computeTemporaryFortune）。
 *
 * - 身强日主：G = 克泄耗，J = 帮扶
 * - 身弱日主：G = 帮扶，J = 克泄耗
 * - 中和/专旺/从弱：按喜用/忌神五行匹配大运天干
 */
export function judgeFortuneLevel(
  dayunStem: Stem,
  tempFortune: TemporaryFortuneResult,
  strengthType: StrengthType,
  xiyongshen: Wuxing[],
  jishen: Wuxing[],
): FortuneLevel {
  // 所有类型统一用 R = G/(G+J) 计算
  // G = 有利力量，J = 不利力量
  let G: number;
  let J: number;

  if (strengthType === "身强") {
    // 身强喜克泄耗
    G = tempFortune.kexiehao_total;
    J = tempFortune.bangfu_total;
  } else if (strengthType === "身弱") {
    // 身弱喜帮扶
    G = tempFortune.bangfu_total;
    J = tempFortune.kexiehao_total;
  } else if (strengthType === "专旺格") {
    // 专旺喜顺势（帮扶为有利）
    G = tempFortune.bangfu_total;
    J = tempFortune.kexiehao_total;
  } else if (strengthType === "从弱格") {
    // 从弱喜顺从（克泄耗为有利）
    G = tempFortune.kexiehao_total;
    J = tempFortune.bangfu_total;
  } else {
    // 中和：按喜用/忌神五行匹配大运天干决定 G/J
    const dayunWuxing = wuxingOf(dayunStem);
    if (xiyongshen.includes(dayunWuxing)) {
      G = tempFortune.bangfu_total + tempFortune.kexiehao_total;
      J = 0;
    } else if (jishen.includes(dayunWuxing)) {
      G = 0;
      J = tempFortune.bangfu_total + tempFortune.kexiehao_total;
    } else {
      G = tempFortune.bangfu_total;
      J = tempFortune.kexiehao_total;
    }
  }

  const R = (G + J) > 0 ? G / (G + J) : 0.5;

  if (R >= 0.8) return "大吉";
  if (R >= 0.6) return "吉";
  if (R >= 0.4) return "平";
  if (R >= 0.2) return "凶";
  return "大凶";
}

// ── 标签规则 ─────────────────────────────────────────────────────

const ALL_TEN_GODS: TenGod[] = [
  "比肩", "劫财", "正印", "偏印",
  "食神", "伤官", "正财", "偏财",
  "正官", "七杀",
];

/** 计算十神占比（某十神 count / 全部十神 count 总和） */
function tenGodRatio(tenGodsCount: Record<TenGod, number>, tg: TenGod): number {
  const total = ALL_TEN_GODS.reduce((s, g) => s + tenGodsCount[g], 0);
  return total > 0 ? tenGodsCount[tg] / total : 0;
}

/** 十神旺弱等级（按占比） */
type TenGodStrength = "极旺" | "旺" | "平" | "弱";

function tenGodStrength(tenGodsCount: Record<TenGod, number>, tg: TenGod): TenGodStrength {
  const ratio = tenGodRatio(tenGodsCount, tg);
  if (ratio >= 0.3) return "极旺";
  if (ratio >= 0.2) return "旺";
  if (ratio >= 0.1) return "平";
  return "弱";
}

/** 某十神是否旺或极旺 */
function isTGWang(tenGodsCount: Record<TenGod, number>, tg: TenGod): boolean {
  const s = tenGodStrength(tenGodsCount, tg);
  return s === "旺" || s === "极旺";
}

/** 某十神是否弱 */
function isTGWeak(tenGodsCount: Record<TenGod, number>, tg: TenGod): boolean {
  return tenGodStrength(tenGodsCount, tg) === "弱";
}

/** 两个十神合占是否弱 */
function isTGPairWeak(tenGodsCount: Record<TenGod, number>, a: TenGod, b: TenGod): boolean {
  const total = ALL_TEN_GODS.reduce((s, g) => s + tenGodsCount[g], 0);
  return total > 0 ? (tenGodsCount[a] + tenGodsCount[b]) / total < 0.1 : true;
}

export interface LabelRule {
  condition: string;
  label: string;
  explanation: string;
}

export interface DimensionLabels {
  dimension: string;
  labels: readonly LabelRule[];
}

// 性格标签
function personalityLabels(
  strengthType: StrengthType,
  tenGodsCount: Record<TenGod, number>,
): LabelRule[] {
  const rules: LabelRule[] = [];

  if (strengthType === "专旺格" || strengthType === "身强") {
    rules.push({ condition: "身强/专旺", label: "性格刚毅、自信果断、有主见", explanation: "身强之人意志坚定，执行力强" });
  } else if (strengthType === "从弱格" || strengthType === "身弱") {
    rules.push({ condition: "身弱/从弱", label: "心思细腻、灵活变通、善于观察", explanation: "身弱之人敏感多思，适应力强" });
  } else {
    rules.push({ condition: "中和", label: "性格温和、稳重踏实、进退有度", explanation: "中和之人性情平和，处事稳重" });
  }

  if (isTGWang(tenGodsCount, "正印")) {
    rules.push({ condition: "正印旺", label: "善良包容、有爱心、重精神世界", explanation: "正印代表慈爱，旺则心善" });
  }
  if (isTGWang(tenGodsCount, "偏印")) {
    rules.push({ condition: "偏印旺", label: "思维独特、直觉敏锐、喜独处思考", explanation: "偏印代表非常规思维" });
  }
  if (isTGWang(tenGodsCount, "比肩")) {
    rules.push({ condition: "比肩旺", label: "独立自主、自我意识强、朋友缘好", explanation: "比肩代表自我与同辈" });
  }
  if (isTGWang(tenGodsCount, "劫财")) {
    rules.push({ condition: "劫财旺", label: "行动力强、争强好胜、需防冲动", explanation: "劫财代表竞争与冲劲" });
  }
  if (isTGWang(tenGodsCount, "食神")) {
    rules.push({ condition: "食神旺", label: "温和乐观、有才艺天赋、享受生活", explanation: "食神代表才华与享受" });
  }
  if (isTGWang(tenGodsCount, "伤官")) {
    rules.push({ condition: "伤官旺", label: "聪明叛逆、表达欲强、不喜约束", explanation: "伤官代表才华与叛逆" });
  }
  if (isTGWang(tenGodsCount, "正官")) {
    rules.push({ condition: "正官旺", label: "守规矩、有责任感、重名誉", explanation: "正官代表自律与规范" });
  }
  if (isTGWang(tenGodsCount, "七杀")) {
    rules.push({ condition: "七杀旺", label: "果断有魄力、敢冒险、需防急躁", explanation: "七杀代表威权与冲击" });
  }

  return rules;
}

// 事业标签
function careerLabels(
  strengthType: StrengthType,
  tenGodsCount: Record<TenGod, number>,
): LabelRule[] {
  const rules: LabelRule[] = [];

  if (isTGWang(tenGodsCount, "正官")) {
    rules.push({ condition: "正官旺", label: "适合体制内/管理岗、升职有助力", explanation: "正官为正统职权，适合管理" });
  }
  if (isTGWang(tenGodsCount, "七杀")) {
    rules.push({ condition: "七杀旺", label: "适合创业/开拓型岗位、有魄力", explanation: "七杀为偏权，适合开创" });
  }
  if (isTGWang(tenGodsCount, "正印")) {
    rules.push({ condition: "正印旺", label: "适合教育/研究/文化行业、贵人运强", explanation: "正印为学术贵人" });
  }
  if (isTGWang(tenGodsCount, "偏印")) {
    rules.push({ condition: "偏印旺", label: "适合技术/设计/自由职业、思维创新", explanation: "偏印代表非主流才华" });
  }
  if (isTGWang(tenGodsCount, "食神")) {
    rules.push({ condition: "食神旺", label: "适合创意/服务/餐饮行业、有口福", explanation: "食神为才华展现" });
  }
  if (isTGWang(tenGodsCount, "伤官")) {
    rules.push({ condition: "伤官旺", label: "适合艺术/表演/自由职业、表达力强", explanation: "伤官为才华外露" });
  }
  if (strengthType === "身强") {
    rules.push({ condition: "身强", label: "事业心强、适合独当一面", explanation: "身强之人自主性强" });
  }
  if (strengthType === "身弱") {
    rules.push({ condition: "身弱", label: "适合团队合作、贵人提携很重要", explanation: "身弱需他人助力" });
  }

  if (rules.length === 0) {
    rules.push({ condition: "事业中和", label: "事业平稳、循序渐进", explanation: "事业相关十神中和，平稳发展" });
  }

  return rules;
}

// 财运标签
function wealthLabels(
  strengthType: StrengthType,
  tenGodsCount: Record<TenGod, number>,
  gender: "male" | "female",
): LabelRule[] {
  const rules: LabelRule[] = [];

  if (isTGWang(tenGodsCount, "正财")) {
    rules.push({ condition: "正财旺", label: "薪资稳定、踏实求财、理财谨慎", explanation: "正财为稳定收入" });
  }
  if (isTGWang(tenGodsCount, "偏财")) {
    rules.push({ condition: "偏财旺", label: "副业/投资机会多、偏财运佳", explanation: "偏财为意外收入" });
  }
  if (isTGWang(tenGodsCount, "比肩") && strengthType === "身强") {
    rules.push({ condition: "比肩旺(身强)", label: "合作求财、适合合伙创业", explanation: "身强比劫帮身，适合合作" });
  }
  if (isTGWang(tenGodsCount, "比肩") && strengthType === "身弱") {
    rules.push({ condition: "比肩旺(身弱)", label: "防破财、忌大额合伙投资", explanation: "身弱比劫夺财，易破财" });
  }
  if (isTGWang(tenGodsCount, "食神") || isTGWang(tenGodsCount, "伤官")) {
    rules.push({ condition: "食伤旺(生财)", label: "靠才华/技能求财、收入多元", explanation: "食伤生财，靠创意赚钱" });
  }
  if (isTGWang(tenGodsCount, "正印") || isTGWang(tenGodsCount, "偏印")) {
    rules.push({ condition: "印星旺(耗财)", label: "易因学习/人情开销、理财需规划", explanation: "印星耗财，易因学习人情花钱" });
  }

  if (rules.length === 0) {
    rules.push({ condition: "财运中和", label: "财运平稳、量入为出", explanation: "财运相关十神中和，收支平衡" });
  }

  return rules;
}

// 感情标签
function romanceLabels(
  tenGodsCount: Record<TenGod, number>,
  gender: "male" | "female",
): LabelRule[] {
  const rules: LabelRule[] = [];

  // 性别专属
  if (gender === "male") {
    if (isTGWang(tenGodsCount, "正财")) {
      rules.push({ condition: "男命正财旺", label: "异性缘佳、重感情、对伴侣大方", explanation: "男命以财为妻，财旺异性缘好" });
    }
    if (isTGWang(tenGodsCount, "偏财")) {
      rules.push({ condition: "男命偏财旺", label: "桃花旺、异性缘多、需专一", explanation: "偏财为偏妻缘" });
    }
    if (isTGPairWeak(tenGodsCount, "正财", "偏财")) {
      rules.push({ condition: "男命财星弱", label: "异性缘平淡、感情慢热、重精神契合", explanation: "财弱异性缘一般" });
    }
  }

  if (gender === "female") {
    if (isTGWang(tenGodsCount, "正官")) {
      rules.push({ condition: "女命正官旺", label: "姻缘稳定、择偶谨慎、重视责任感", explanation: "女命以官为夫，官旺重稳定" });
    }
    if (isTGWang(tenGodsCount, "七杀")) {
      rules.push({ condition: "女命七杀旺", label: "异性缘强但易波折、需谨慎选择", explanation: "七杀为偏夫缘，感情多波折" });
    }
    if (isTGPairWeak(tenGodsCount, "正官", "七杀")) {
      rules.push({ condition: "女命官杀弱", label: "感情随缘、不将就、宁缺毋滥", explanation: "官弱对感情不将就" });
    }
  }

  // 通用
  if (isTGWang(tenGodsCount, "食神") || isTGWang(tenGodsCount, "伤官")) {
    rules.push({ condition: "食伤旺(通用)", label: "浪漫感性、追求灵魂契合、不喜束缚", explanation: "食伤旺重感觉，不喜束缚" });
  }
  if (isTGWang(tenGodsCount, "比肩") || isTGWang(tenGodsCount, "劫财")) {
    rules.push({ condition: "比劫旺(通用)", label: "感情中易争强好胜、需学会包容", explanation: "比劫旺好胜，感情中易争执" });
  }

  // 兜底：十神中和时也需有标签
  if (rules.length === 0) {
    rules.push({
      condition: "感情中和",
      label: "感情平淡安稳、顺其自然",
      explanation: "感情相关十神中和，感情方面平稳无大起大落",
    });
  }

  return rules;
}

// 健康标签
function healthLabels(
  wuxingStats: Record<Wuxing, "极旺" | "旺" | "中和" | "弱" | "极弱">,
): LabelRule[] {
  const rules: LabelRule[] = [];
  const wuxingOrgan: Record<Wuxing, string> = {
    木: "肝胆、四肢、神经系统",
    火: "心脑血管、眼睛、血液循环",
    土: "脾胃、消化系统、肌肉",
    金: "肺呼吸系统、皮肤、大肠",
    水: "肾泌尿系统、生殖系统、骨骼",
  };

  for (const wx of ["金", "木", "水", "火", "土"] as Wuxing[]) {
    const level = wuxingStats[wx];
    if (level === "极旺" || level === "旺") {
      rules.push({
        condition: `${wx}偏旺`,
        label: `${wuxingOrgan[wx]}易亢奋，需注意情绪调节/清淡饮食`,
        explanation: `${wx}旺则对应脏腑易亢奋`,
      });
    } else if (level === "极弱" || level === "弱") {
      rules.push({
        condition: `${wx}偏弱`,
        label: `${wuxingOrgan[wx]}易疲劳，需注意养护/规律作息`,
        explanation: `${wx}弱则对应脏腑易虚`,
      });
    }
  }

  // 特殊组合
  if (wuxingStats["水"] === "极弱" && wuxingStats["火"] === "极旺") {
    rules.push({ condition: "水极弱火极旺", label: "易失眠焦虑、需注意心肾养护", explanation: "水火失衡，易情绪和睡眠问题" });
  }
  if (wuxingStats["土"] === "极弱" && wuxingStats["木"] === "极旺") {
    rules.push({ condition: "土极弱木极旺", label: "易肠胃不适、需注意饮食调理", explanation: "木克土，易肠胃问题" });
  }

  if (rules.length === 0) {
    rules.push({ condition: "健康中和", label: "体质平稳、注意作息规律", explanation: "五行中和，体质平衡" });
  }

  return rules;
}

// 人际标签
function socialLabels(
  tenGodsCount: Record<TenGod, number>,
  shenshaNames: readonly string[],
): LabelRule[] {
  const rules: LabelRule[] = [];

  if (shenshaNames.includes("天乙贵人")) {
    rules.push({ condition: "带天乙贵人", label: "贵人运强、遇事有人帮、适合求助他人", explanation: "天乙为第一贵人" });
  }
  if (isTGWang(tenGodsCount, "比肩") || isTGWang(tenGodsCount, "劫财")) {
    rules.push({ condition: "比劫旺", label: "朋友缘好、讲义气、适合团队合作", explanation: "比劫为同党，朋友缘好" });
  }
  if (shenshaNames.includes("华盖")) {
    rules.push({ condition: "带华盖", label: "喜独处、精神世界丰富、不喜无效社交", explanation: "华盖主孤，不喜热闹社交" });
  }
  if (shenshaNames.includes("劫煞") || isTGPairWeak(tenGodsCount, "比肩", "劫财")) {
    rules.push({ condition: "带劫煞/比劫弱", label: "人际中易遇小人、需注意边界感", explanation: "比劫弱或带劫煞，易犯小人" });
  }
  if (isTGWang(tenGodsCount, "正印") || isTGWang(tenGodsCount, "偏印")) {
    rules.push({ condition: "印星旺", label: "待人温和、易获得长辈/前辈赏识", explanation: "印星为长辈，易受长辈帮助" });
  }

  if (rules.length === 0) {
    rules.push({ condition: "人际中和", label: "人际关系平稳、保持真诚即可", explanation: "人际相关十神中和" });
  }

  return rules;
}

// ── 主入口 ───────────────────────────────────────────────────────

const MAX_LABELS_PER_DIM = 5;
const MIN_LABELS_PER_DIM = 3;

/** 按优先级排序并截取标签，去矛盾 */
function dedupeAndCap(labels: LabelRule[], max = MAX_LABELS_PER_DIM, min = MIN_LABELS_PER_DIM): LabelRule[] {
  // 优先级：condition 含"身强/专旺/身弱/从弱/中和" > 含"极旺" > 含"旺" > 其余
  const priority = (l: LabelRule): number => {
    const c = l.condition;
    if (c.includes("身强") || c.includes("专旺") || c.includes("身弱") || c.includes("从弱") || c.includes("中和")) return 3;
    if (c.includes("极旺")) return 2;
    if (c.includes("旺")) return 1;
    return 0;
  };

  const sorted = [...labels].sort((a, b) => priority(b) - priority(a));

  // 互斥：同维度内"旺"和"弱"矛盾时保留高优先级
  const kept: LabelRule[] = [];
  const seenWeak = new Set<string>(); // 记录已选的弱项十神

  for (const label of sorted) {
    if (kept.length >= max) break;

    // 检查矛盾：如果已选了某十神"旺"，跳过同十神"弱"
    const tgMatch = label.condition.match(/(正印|偏印|比肩|劫财|食神|伤官|正财|偏财|正官|七杀|财星|官杀|比劫|印星|食伤)/);
    if (tgMatch) {
      const tg = tgMatch[1]!;
      if (label.condition.includes("弱") && seenWeak.has(tg)) continue;
      if (!label.condition.includes("弱")) seenWeak.add(tg);
    }

    kept.push(label);
  }

  return kept.slice(0, max);
}

export function generateAllLabels(
  pillars: BaziPillars,
  strengthType: StrengthType,
  tenGodsCount: Record<TenGod, number>,
  wuxingStrength: Record<Wuxing, "极旺" | "旺" | "中和" | "弱" | "极弱">,
  shenshaNames: readonly string[],
  gender: "male" | "female",
): DimensionLabels[] {
  return [
    { dimension: "性格", labels: dedupeAndCap(personalityLabels(strengthType, tenGodsCount)) },
    { dimension: "事业", labels: dedupeAndCap(careerLabels(strengthType, tenGodsCount)) },
    { dimension: "财运", labels: dedupeAndCap(wealthLabels(strengthType, tenGodsCount, gender)) },
    { dimension: "感情", labels: dedupeAndCap(romanceLabels(tenGodsCount, gender)) },
    { dimension: "健康", labels: dedupeAndCap(healthLabels(wuxingStrength)) },
    { dimension: "人际", labels: dedupeAndCap(socialLabels(tenGodsCount, shenshaNames)) },
  ];
}
