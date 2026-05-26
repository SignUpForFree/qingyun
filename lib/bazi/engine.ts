/**
 * 八字核心计算引擎
 *
 * 流水线: 五行计数 → 刑冲合害修正 → 旺相休囚死缩放 → 日主微调 → 十神汇总
 */

import type { BaziPillars } from "@/types/domain";
import {
  type Wuxing, type Stem, type Branch, type TenGod, type WangXiangStatus,
  type HiddenStemEntry,
  wuxingOf, yinyangOfStem, tenGod, tenGodCamp,
  HIDDEN_STEMS_DETAILED,
  YUELING_WUXING, wangXiangStatus, WANG_XIANG_COEFF, dayMasterAdjustScore,
  BRANCH_CHONG, isTongleiChong,
  SAN_HUI_GROUPS, SAN_HE_RULES, LIU_HE_RULES, LIU_HAI_PAIRS, SAN_XING_RULES, ZI_XING_BRANCHES,
  SHENG_CYCLE, KE_CYCLE, TONGGUAN_MAP,
} from "./stems-branches";

// ── 类型 ──────────────────────────────────────────────────────────

export interface WuxingCountMap extends Record<Wuxing, number> {}

export interface WuxingStats {
  total_count: WuxingCountMap;
  energy_score: WuxingCountMap;
  strength_level: Record<Wuxing, "极旺" | "旺" | "中和" | "弱" | "极弱">;
  proportion: Record<Wuxing, string>;
  wuxing_feature: string;
}

export interface XchhResult {
  working_count: WuxingCountMap;
  matches: readonly XchhMatch[];
}

export interface XchhMatch {
  type: "三会" | "三合" | "六合" | "六冲" | "三刑" | "六害" | "自刑";
  branches: readonly Branch[];
  detail: string;
  success?: boolean;
}

export interface TenGodsResult {
  tian_gan_ten_gods: Record<string, TenGod | "日主">;
  zhi_ten_gods: Record<string, string>;
  ten_gods_count: Record<TenGod, number>;
  bangfu_total: number;
  kexiehao_total: number;
}

// ── 1. 五行加权计数 ───────────────────────────────────────────────

const WUXING_ZERO: WuxingCountMap = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };

/** 从可变干支列表计算五行 count 分（含权重） */
export function computeWuxingCountFromGanZhi(ganZhiList: ReadonlyArray<{ gan: Stem; zhi: Branch }>): WuxingCountMap {
  const count = { ...WUXING_ZERO };

  for (const p of ganZhiList) {
    count[wuxingOf(p.gan)] += 1;
    for (const entry of HIDDEN_STEMS_DETAILED[p.zhi]) {
      count[entry.wuxing] += entry.coefficient;
    }
  }

  return count;
}

/** 从四柱天干+地支藏干计算五行 count 分（含权重） */
export function computeWuxingCount(pillars: BaziPillars): WuxingCountMap {
  return computeWuxingCountFromGanZhi([
    pillars.year, pillars.month, pillars.day, pillars.hour,
  ]);
}

/** 五行统计（能量分 + 强弱等级 + 占比 + 特征） */
export function computeWuxingStats(
  count: WuxingCountMap,
  monthZhi: Branch,
): WuxingStats {
  const total = Object.values<number>(count).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return {
      total_count: { ...WUXING_ZERO },
      energy_score: { ...WUXING_ZERO },
      strength_level: { 金: "极弱", 木: "极弱", 水: "极弱", 火: "极弱", 土: "极弱" },
      proportion: { 金: "0%", 木: "0%", 水: "0%", 火: "0%", 土: "0%" },
      wuxing_feature: "五行数据为空",
    };
  }

  const yuelingWX = YUELING_WUXING[monthZhi];
  const allWuxing: Wuxing[] = ["金", "木", "水", "火", "土"];

  const energy_score: WuxingCountMap = { ...WUXING_ZERO };
  for (const wx of allWuxing) {
    const base = (count[wx] / total!) * 100;
    const bonus = wx === yuelingWX ? 10 : 0;
    energy_score[wx] = Math.round((base + bonus) * 10) / 10;
  }

  const strength_level = {} as Record<Wuxing, "极旺" | "旺" | "中和" | "弱" | "极弱">;
  for (const wx of allWuxing) {
    const s = energy_score[wx];
    if (s >= 60) strength_level[wx] = "极旺";
    else if (s >= 40) strength_level[wx] = "旺";
    else if (s >= 25) strength_level[wx] = "中和";
    else if (s >= 10) strength_level[wx] = "弱";
    else strength_level[wx] = "极弱";
  }

  const proportion = {} as Record<Wuxing, string>;
  for (const wx of allWuxing) {
    proportion[wx] = `${((count[wx] / total!) * 100).toFixed(1)}%`;
  }

  // 五行特征描述（§4.4 格式：如"木旺金缺，水火平衡，土偏弱"）
  const parts: string[] = [];
  for (const wx of allWuxing) {
    const level = strength_level[wx];
    if (level === "极旺") parts.push(`${wx}极旺`);
    else if (level === "旺") parts.push(`${wx}旺`);
    else if (level === "弱") parts.push(`${wx}偏弱`);
    else if (level === "极弱") parts.push(`${wx}缺`);
  }
  // 中和五行合并为"X平衡"
  const mid = allWuxing.filter((wx) => strength_level[wx] === "中和");
  if (mid.length > 0) parts.push(`${mid.join("")}平衡`);
  const wuxing_feature = parts.join("，") || "五行均衡";

  return { total_count: { ...count }, energy_score, strength_level, proportion, wuxing_feature };
}

// ── 2. 刑冲合害修正 ──────────────────────────────────────────────

/** 通用版：接受地支数组（原局4 + 大运1 + 可选流年1） */
export function applyXchhCorrectionOnZhi(
  allZhi: readonly Branch[],
  monthZhi: Branch,
  baseCount: WuxingCountMap,
): XchhResult {
  const working = { ...baseCount };
  const matches: XchhMatch[] = [];
  const locked = new Set<Branch>();

  // 辅助：获取地支所有藏干的 count 分总和
  function zhiCountSum(zhi: Branch): number {
    return HIDDEN_STEMS_DETAILED[zhi].reduce((s, e) => s + working[e.wuxing] * (e.coefficient / Math.max(0.001, baseCount[e.wuxing] || 0.001)), 0);
  }

  // 辅助：清零地支藏干的 count 分
  function zeroZhi(zhi: Branch) {
    for (const e of HIDDEN_STEMS_DETAILED[zhi]) {
      const deduct = e.coefficient;
      working[e.wuxing] = Math.max(0, working[e.wuxing] - deduct);
    }
  }

  // 辅助：对地支藏干 count 分乘以系数
  function scaleZhi(zhi: Branch, factor: number) {
    // 先减去原始值，再加回缩放后的值
    for (const e of HIDDEN_STEMS_DETAILED[zhi]) {
      working[e.wuxing] = Math.max(0, working[e.wuxing] - e.coefficient + e.coefficient * factor);
    }
  }

  // 辅助：检查原局地支中是否存在冲忌
  function hasChongTaboo(tabooList: readonly Branch[]): boolean {
    return tabooList.some((t) => allZhi.includes(t));
  }

  // ---- 优先级 1: 三会方 ----
  for (const group of SAN_HUI_GROUPS) {
    if (group.members.every((m) => allZhi.includes(m) && !locked.has(m))) {
      // 计算三个地支藏干 count 总和
      let sum = 0;
      for (const m of group.members) {
        for (const e of HIDDEN_STEMS_DETAILED[m]) {
          sum += e.coefficient;
        }
      }

      // 清零三个地支的藏干 count
      for (const m of group.members) zeroZhi(m);

      // 三会五行 count = 总和 × 3
      working[group.transform] += sum * 3;

      for (const m of group.members) locked.add(m);
      matches.push({ type: "三会", branches: [...group.members], detail: `${group.members.join("")}三会${group.transform}局` });

      // 三会成功后只剩1个地支，无法再形成组合
      break;
    }
  }

  // ---- 优先级 2: 三合局 ----
  for (const rule of SAN_HE_RULES) {
    if (rule.members.every((m) => allZhi.includes(m) && !locked.has(m))) {
      // 合化条件
      const cond1 = rule.wangdiMonths.includes(monthZhi);
      const cond2 = !hasChongTaboo(rule.chongTaboo);
      const success = cond1 && cond2;

      let sum = 0;
      for (const m of rule.members) {
        for (const e of HIDDEN_STEMS_DETAILED[m]) sum += e.coefficient;
      }

      if (success) {
        // 合化成功：清零 + ×2
        for (const m of rule.members) zeroZhi(m);
        working[rule.transform] += sum * 2;
      } else {
        // 合化失败：×1.1
        for (const m of rule.members) scaleZhi(m, 1.1);
      }

      for (const m of rule.members) locked.add(m);
      matches.push({
        type: "三合", branches: [...rule.members],
        detail: `${rule.members.join("")}三合${rule.transform}局${success ? "合化成功" : "合而不化"}`,
        success,
      });
      break;
    }
  }

  // ---- 优先级 3: 三刑 ----
  for (const rule of SAN_XING_RULES) {
    if (rule.members.every((m) => allZhi.includes(m) && !locked.has(m))) {
      for (const m of rule.members) scaleZhi(m, 0.8);
      for (const m of rule.members) locked.add(m);
      matches.push({
        type: "三刑", branches: [...rule.members],
        detail: `${rule.members.join("")}${rule.type}`,
      });
    }
  }

  // ---- 优先级 4: 六合 ----
  for (const rule of LIU_HE_RULES) {
    const [a, b] = rule.pair;
    if (allZhi.includes(a) && allZhi.includes(b) && !locked.has(a) && !locked.has(b)) {
      const cond1 = rule.wangdiMonths.includes(monthZhi);
      const cond2 = !hasChongTaboo(rule.chongTaboo);
      const success = cond1 && cond2;

      let sum = 0;
      for (const z of [a, b]) {
        for (const e of HIDDEN_STEMS_DETAILED[z]) sum += e.coefficient;
      }

      if (success) {
        for (const z of [a, b]) zeroZhi(z);
        working[rule.transform] += sum * 1.2;
      } else {
        for (const z of [a, b]) scaleZhi(z, 1.1);
      }

      locked.add(a);
      locked.add(b);
      matches.push({
        type: "六合", branches: [a, b],
        detail: `${a}${b}六合${success ? `化${rule.transform}` : "合而不化"}`,
        success,
      });
    }
  }

  // ---- 优先级 5: 六冲 ----
  const checked = new Set<string>();
  for (let i = 0; i < allZhi.length; i++) {
    for (let j = i + 1; j < allZhi.length; j++) {
      const a = allZhi[i]!, b = allZhi[j]!;
      if (locked.has(a) || locked.has(b)) continue;
      const key = [a, b].sort().join("-");
      if (checked.has(key)) continue;
      if (BRANCH_CHONG[a] !== b) continue;
      checked.add(key);

      const isTonglei = isTongleiChong(a, b);
      const factor = isTonglei ? 0.5 : 0.7;
      scaleZhi(a, factor);
      scaleZhi(b, factor);
      locked.add(a);
      locked.add(b);
      matches.push({
        type: "六冲", branches: [a, b],
        detail: `${a}${b}冲${isTonglei ? "(同类冲力更强)" : ""}`,
      });
    }
  }

  // ---- 优先级 6: 六害 ----
  for (const [a, b] of LIU_HAI_PAIRS) {
    if (allZhi.includes(a) && allZhi.includes(b) && !locked.has(a) && !locked.has(b)) {
      scaleZhi(a, 0.9);
      scaleZhi(b, 0.9);
      locked.add(a);
      locked.add(b);
      matches.push({
        type: "六害", branches: [a, b],
        detail: `${a}${b}害`,
      });
    }
  }

  // ---- 优先级 7: 自刑 ----
  for (const target of ZI_XING_BRANCHES) {
    const indices = allZhi.reduce<number[]>((acc, z, i) => z === target && !locked.has(z) ? [...acc, i] : acc, []);
    if (indices.length >= 2) {
      for (const idx of indices) {
        scaleZhi(allZhi[idx]!, 0.7);
        locked.add(allZhi[idx]!);
      }
      matches.push({
        type: "自刑", branches: indices.map((i) => allZhi[i]!),
        detail: `${target}自刑(×${indices.length})`,
      });
    }
  }

  // 非负处理
  for (const wx of ["金", "木", "水", "火", "土"] as Wuxing[]) {
    if (working[wx] < 0) working[wx] = 0;
  }

  return { working_count: working, matches };
}

/** 原局四柱版（兼容现有调用） */
export function applyXchhCorrection(
  pillars: BaziPillars,
  baseCount: WuxingCountMap,
): XchhResult {
  return applyXchhCorrectionOnZhi(
    [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi],
    pillars.month.zhi,
    baseCount,
  );
}

// ── 3. 旺相休囚死缩放 ─────────────────────────────────────────────

export function applyWangXiangScaling(
  workingCount: WuxingCountMap,
  monthZhi: Branch,
): { scaled: WuxingCountMap; yuelingWuxing: Wuxing; dayMasterStatus: WangXiangStatus } {
  const yuelingWX = YUELING_WUXING[monthZhi];
  const scaled = { ...WUXING_ZERO };
  const allWuxing: Wuxing[] = ["金", "木", "水", "火", "土"];

  for (const wx of allWuxing) {
    const status = wangXiangStatus(yuelingWX, wx);
    scaled[wx] = Math.max(0, workingCount[wx] * WANG_XIANG_COEFF[status]);
  }

  return { scaled, yuelingWuxing: yuelingWX, dayMasterStatus: wangXiangStatus(yuelingWX, yuelingWX) };
}

// ── 4. 日主微调加分 ────────────────────────────────────────────────

export function applyDayMasterAdjust(
  scaled: WuxingCountMap,
  dayGan: Stem,
  monthZhi: Branch,
): { final: WuxingCountMap; dayMasterStatus: WangXiangStatus; adjustScore: number } {
  const dayWX = wuxingOf(dayGan);
  const yuelingWX = YUELING_WUXING[monthZhi];
  const status = wangXiangStatus(yuelingWX, dayWX);
  const adjust = dayMasterAdjustScore(status);

  const final = { ...scaled };
  final[dayWX] = Math.max(0, final[dayWX] + adjust);

  return { final, dayMasterStatus: status, adjustScore: adjust };
}

// ── 5. 十神汇总 ───────────────────────────────────────────────────

export function computeTenGods(
  pillars: BaziPillars,
  finalScores: WuxingCountMap,
): TenGodsResult {
  const dayGan = pillars.day.gan;
  const dayWX = wuxingOf(dayGan);

  // 天干十神
  const tian_gan_ten_gods: Record<string, TenGod | "日主"> = {
    "年干": tenGod(dayGan, pillars.year.gan),
    "月干": tenGod(dayGan, pillars.month.gan),
    "日干": "日主",
    "时干": tenGod(dayGan, pillars.hour.gan),
  };

  // 地支藏干十神
  const zhi_ten_gods: Record<string, string> = {};
  const zhiLabels = ["年支", "月支", "日支", "时支"] as const;
  const zhis = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
  for (let i = 0; i < 4; i++) {
    const entries = HIDDEN_STEMS_DETAILED[zhis[i]!];
    zhi_ten_gods[zhiLabels[i]!] = entries.map((e) => tenGod(dayGan, e.gan)).join("+");
  }

  // 十神数量加权统计
  const ten_gods_count: Record<TenGod, number> = {
    比肩: 0, 劫财: 0, 正印: 0, 偏印: 0,
    食神: 0, 伤官: 0, 正财: 0, 偏财: 0,
    正官: 0, 七杀: 0,
  };

  // 天干（除日主）
  for (const gan of [pillars.year.gan, pillars.month.gan, pillars.hour.gan]) {
    ten_gods_count[tenGod(dayGan, gan)] += 1;
  }

  // 地支藏干（含权重）
  for (const zhi of zhis) {
    for (const e of HIDDEN_STEMS_DETAILED[zhi]) {
      ten_gods_count[tenGod(dayGan, e.gan)] += e.coefficient;
    }
  }

  // 按阵营汇总能量分
  let bangfu_total = 0;
  let kexiehao_total = 0;

  // 帮扶 = 印星五行 + 比劫五行的缩放分
  const supportWuxing = new Set<Wuxing>([dayWX, inverseSheng(dayWX)]);
  const opposeWuxing = new Set<Wuxing>([
    SHENG_CYCLE[dayWX],    // 我生
    KE_CYCLE[dayWX],        // 我克
    inverseKe(dayWX),       // 克我
  ]);

  for (const wx of ["金", "木", "水", "火", "土"] as Wuxing[]) {
    if (supportWuxing.has(wx)) bangfu_total += finalScores[wx];
    if (opposeWuxing.has(wx)) kexiehao_total += finalScores[wx];
  }

  return { tian_gan_ten_gods, zhi_ten_gods, ten_gods_count, bangfu_total, kexiehao_total };
}

function inverseSheng(target: Wuxing): Wuxing {
  for (const [from, to] of Object.entries(SHENG_CYCLE) as Array<[Wuxing, Wuxing]>) {
    if (to === target) return from;
  }
  return target;
}

function inverseKe(target: Wuxing): Wuxing {
  for (const [from, to] of Object.entries(KE_CYCLE) as Array<[Wuxing, Wuxing]>) {
    if (to === target) return from;
  }
  return target;
}

// ── 6. 旺衰评分 ──────────────────────────────────────────────────

export type StrengthType = "专旺格" | "身强" | "中和" | "身弱" | "从弱格";

export interface StrengthResult {
  bangfu_total: number;
  kexiehao_total: number;
  yueling_bonus: number;
  final_score: number;
  strength_type: StrengthType;
  strength_desc: string;
}

export function computeStrength(
  tenGodsResult: TenGodsResult,
  finalScores: WuxingCountMap,
  dayGan: Stem,
  yuelingBonus: number = 0,
): StrengthResult {
  const { bangfu_total, kexiehao_total } = tenGodsResult;
  const final_score = Math.round((bangfu_total - kexiehao_total) * 10) / 10;
  const dayWX = wuxingOf(dayGan);
  const totalScore = Object.values<number>(finalScores).reduce((s, v) => s + v, 0);

  // 专旺格判定
  const bangfuRatio = totalScore > 0 ? bangfu_total / totalScore : 0;
  const dayWXRatio = totalScore > 0 ? finalScores[dayWX] / totalScore : 0;
  const isZhuanWang =
    bangfuRatio >= 0.8 &&
    kexiehao_total <= 0.5 &&
    dayWXRatio >= 0.7 &&
    final_score >= 70;

  // 从弱格判定
  const kexiehaoRatio = totalScore > 0 ? kexiehao_total / totalScore : 0;
  // 克泄耗阵营五行：我生(食伤)、我克(财)、克我(官杀)
  const opposeWuxingSet = new Set<Wuxing>([
    SHENG_CYCLE[dayWX], KE_CYCLE[dayWX], inverseKe(dayWX),
  ]);
  const maxOpposeRatio = totalScore > 0
    ? Math.max(...[...opposeWuxingSet].map((wx) => finalScores[wx] / totalScore))
    : 0;
  const isCongRuo =
    kexiehaoRatio >= 0.8 &&
    bangfu_total <= 0.5 &&
    maxOpposeRatio >= 0.7 &&
    final_score < 20;

  let strength_type: StrengthType;
  let strength_desc: string;

  if (isZhuanWang) {
    strength_type = "专旺格";
    strength_desc = `日主${dayWX}极旺无制，从一专之气`;
  } else if (isCongRuo) {
    strength_type = "从弱格";
    strength_desc = `日主${dayWX}无根全失，从异党之势`;
  } else if (final_score > 10) {
    strength_type = "身强";
    strength_desc = `日主${dayWX}帮扶有力，身强偏旺`;
  } else if (final_score >= -10) {
    strength_type = "中和";
    strength_desc = `日主${dayWX}五行均衡，中和偏稳`;
  } else {
    strength_type = "身弱";
    strength_desc = `日主${dayWX}能量偏弱，宜生扶`;
  }

  return {
    bangfu_total: Math.round(bangfu_total * 10) / 10,
    kexiehao_total: Math.round(kexiehao_total * 10) / 10,
    yueling_bonus: yuelingBonus,
    final_score,
    strength_type,
    strength_desc,
  };
}

// ── 7. 喜用神/忌神/调候/通关 ──────────────────────────────────────

export interface YongShenFull {
  xiyongshen: Wuxing[];
  yongshen: Wuxing[];
  jishen: Wuxing[];
  xianshen: Wuxing[];
  tiaohou_shen: Wuxing[];
  tongguan_wuxing: Wuxing[];
  desc: string;
}

export function computeYongShenFull(
  strength: StrengthResult,
  dayGan: Stem,
  monthZhi: Branch,
  finalScores: WuxingCountMap,
  xchhMatches: readonly XchhMatch[],
): YongShenFull {
  const dayWX = wuxingOf(dayGan);
  const allWX: Wuxing[] = ["金", "木", "水", "火", "土"];

  // 五行生成辅助
  const shengMe = inverseSheng(dayWX);    // 印
  const woSheng = SHENG_CYCLE[dayWX];      // 食伤
  const keMe = inverseKe(dayWX);           // 官杀
  const woKe = KE_CYCLE[dayWX];            // 财

  let xiyongshen: Wuxing[] = [];
  let yongshen: Wuxing[] = [];
  let jishen: Wuxing[] = [];
  let xianshen: Wuxing[] = [];

  switch (strength.strength_type) {
    case "专旺格":
      xiyongshen = [dayWX, shengMe];
      yongshen = [woSheng];
      jishen = [keMe, woKe];
      break;
    case "身强":
      xiyongshen = [keMe, woKe, woSheng];
      jishen = [shengMe, dayWX];
      break;
    case "中和": {
      // 平衡五行：取最弱的两行
      const sorted = [...allWX].sort((a, b) => finalScores[a] - finalScores[b]);
      xiyongshen = sorted.slice(0, 2);
      xianshen = allWX.filter((wx) => !xiyongshen.includes(wx));
      break;
    }
    case "身弱":
      xiyongshen = [shengMe, dayWX];
      jishen = [keMe, woKe, woSheng];
      break;
    case "从弱格":
      xiyongshen = [keMe, woKe, woSheng];
      jishen = [shengMe, dayWX];
      break;
  }

  // 调候用神
  const tiaohou_shen = computeTiaohou(monthZhi);

  // 通关五行
  const tongguan_wuxing = computeTongguan(dayGan, finalScores, xchhMatches);

  const desc = `${strength.strength_type}喜${xiyongshen.join("")}${jishen.length > 0 ? `，忌${jishen.join("")}` : ""}${tiaohou_shen.length > 0 ? `，调候用${tiaohou_shen.join("")}` : ""}`;

  return { xiyongshen, yongshen, jishen, xianshen, tiaohou_shen, tongguan_wuxing, desc };
}

function computeTiaohou(monthZhi: Branch): Wuxing[] {
  if (["寅", "卯"].includes(monthZhi)) return ["火", "土"];
  if (["巳", "午"].includes(monthZhi)) return ["水", "金"];
  if (["申", "酉"].includes(monthZhi)) return ["水", "木"];
  if (["亥", "子"].includes(monthZhi)) return ["火", "土"];
  return ["木", "水"]; // 辰未戌丑
}

function computeTongguan(
  dayGan: Stem,
  finalScores: WuxingCountMap,
  xchhMatches: readonly XchhMatch[],
): Wuxing[] {
  const dayWX = wuxingOf(dayGan);
  const results: Wuxing[] = [];

  // 已被六合/三合/三会化解的相克组合
  const resolved = new Set<string>();
  for (const m of xchhMatches) {
    if ((m.type === "三合" || m.type === "六合" || m.type === "三会") && m.success) {
      for (let i = 0; i < m.branches.length; i++) {
        for (let j = i + 1; j < m.branches.length; j++) {
          resolved.add([m.branches[i], m.branches[j]].sort().join("-"));
        }
      }
    }
  }

  // 遍历五行相克组合
  const kePairs: [Wuxing, Wuxing][] = [
    ["金", "木"], ["木", "土"], ["土", "水"], ["水", "火"], ["火", "金"],
  ];

  for (const [a, b] of kePairs) {
    if (finalScores[a] > 0 && finalScores[b] > 0) {
      const key = `tongguan_${a}${b}`;
      const tongguan = TONGGUAN_MAP[`${a}${b}`];
      if (tongguan && finalScores[tongguan] >= 0.5) {
        results.push(tongguan);
      }
    }
  }

  return [...new Set(results)];
}

// ── 8. 临时命局运势（大运/流年） ────────────────────────────────────

export interface TemporaryFortuneArgs {
  /** 原局四柱 */
  pillars: BaziPillars;
  /** 大运天干 */
  dayunStem: Stem;
  /** 大运地支 */
  dayunBranch: Branch;
  /** 可选：流年天干 */
  liunianStem?: Stem;
  /** 可选：流年地支 */
  liunianBranch?: Branch;
  /** 月令地支 */
  monthZhi: Branch;
  /** 日主天干 */
  dayGan: Stem;
  /** 原局旺衰类型 */
  strengthType: StrengthType;
}

export interface TemporaryFortuneResult {
  /** 喜用神能量占比 R = G / (G+J) */
  r: number;
  /** 临时命局帮扶总分 */
  bangfu_total: number;
  /** 临时命局克泄耗总分 */
  kexiehao_total: number;
}

/**
 * 把大运（+可选流年）干支加入原局，形成临时命局，
 * 重跑完整流水线，算出帮扶/克泄耗总分。
 *
 * 流水线：五行计数 → 刑冲合害 → 旺相休囚死 → 日主微调 → 十神汇总
 */
export function computeTemporaryFortune(args: TemporaryFortuneArgs): TemporaryFortuneResult {
  const { pillars, dayunStem, dayunBranch, monthZhi, dayGan, strengthType } = args;

  // 构造临时干支列表（原局4 + 大运1 + 可选流年1）
  const ganZhiList = [
    pillars.year, pillars.month, pillars.day, pillars.hour,
    { gan: dayunStem, zhi: dayunBranch },
  ];
  if (args.liunianStem && args.liunianBranch) {
    ganZhiList.push({ gan: args.liunianStem, zhi: args.liunianBranch });
  }

  // 构造地支列表（用于刑冲合害）
  const allZhi = [
    pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi,
    dayunBranch,
  ];
  if (args.liunianBranch) {
    allZhi.push(args.liunianBranch);
  }

  // 1. 五行加权计数
  const wuxingCount = computeWuxingCountFromGanZhi(ganZhiList);

  // 2. 刑冲合害修正
  const xchhResult = applyXchhCorrectionOnZhi(allZhi, monthZhi, wuxingCount);

  // 3. 旺相休囚死缩放
  const { scaled } = applyWangXiangScaling(xchhResult.working_count, monthZhi);

  // 4. 日主微调
  const { final: finalScores } = applyDayMasterAdjust(scaled, dayGan, monthZhi);

  // 5. 十神汇总
  const tenGodsResult = computeTenGods(pillars, finalScores);

  const { bangfu_total, kexiehao_total } = tenGodsResult;

  // 计算 R 值
  const isStrong = strengthType === "身强";
  const isWeak = strengthType === "身弱";
  const G = isStrong ? kexiehao_total : isWeak ? bangfu_total : 0;
  const J = isStrong ? bangfu_total : isWeak ? kexiehao_total : 0;
  const r = (G + J) > 0 ? G / (G + J) : 0.5;

  return {
    r,
    bangfu_total: Math.round(bangfu_total * 10) / 10,
    kexiehao_total: Math.round(kexiehao_total * 10) / 10,
  };
}
