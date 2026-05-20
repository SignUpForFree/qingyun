import lunar, { type EightChar } from "lunar-javascript";
import type {
  BaziComputed,
  BaziPillars,
  BuildChartInput,
  LuckPillar,
} from "@/types/domain";
import {
  isStem,
  isBranch,
  tenGod,
  wuxingOf,
  type Stem,
  type Branch,
  type Wuxing,
  type TenGod,
  type WangXiangStatus,
  HIDDEN_STEMS_DETAILED,
  YUELING_WUXING,
  nayinOf,
} from "./stems-branches";
import { toSolarTrueTime } from "./solar-time";
import { detectAllShensha, type ShenshaRule } from "./shensha-rules";
import { computeLiunian, computeDayun, type LiunianStep, type DayunStep } from "./dayun";
import {
  computeWuxingCount,
  computeWuxingStats,
  applyXchhCorrection,
  applyWangXiangScaling,
  applyDayMasterAdjust,
  computeTenGods,
  computeStrength,
  computeYongShenFull,
  type WuxingCountMap,
  type WuxingStats,
  type XchhResult,
  type TenGodsResult,
  type StrengthResult,
  type StrengthType,
  type YongShenFull,
  computeTemporaryFortune,
} from "./engine";
import { type YongShenResult, type GejuType } from "./yong-shen";
import {
  generateAllLabels,
  judgeFortuneLevel,
  type DimensionLabels,
  type FortuneLevel,
} from "./labels";

const { Solar, Lunar } = lunar;

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

interface UTC8Fields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getUTC8Fields(t: Date): UTC8Fields {
  const d = new Date(t.getTime() + UTC8_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function buildChart(input: BuildChartInput): BaziComputed {
  const baseSolar = toBaseSolarTime(input);
  const trueTime = toSolarTrueTime(baseSolar, input.longitude);
  const f = getUTC8Fields(trueTime);

  const solar = Solar.fromYmdHms(f.year, f.month, f.day, f.hour, f.minute, f.second);
  const lunarDate = solar.getLunar();
  const eightChar = lunarDate.getEightChar();

  const pillars: BaziPillars = {
    year: parsePillar(eightChar.getYearGan(), eightChar.getYearZhi()),
    month: parsePillar(eightChar.getMonthGan(), eightChar.getMonthZhi()),
    day: parsePillar(eightChar.getDayGan(), eightChar.getDayZhi()),
    hour: parsePillar(eightChar.getTimeGan(), eightChar.getTimeZhi()),
  };

  const fiveElements = countFiveElements(pillars);
  const dayMaster = pillars.day.gan;

  const tenGods = {
    year: tenGod(dayMaster, pillars.year.gan),
    month: tenGod(dayMaster, pillars.month.gan),
    hour: tenGod(dayMaster, pillars.hour.gan),
  };

  const luckPillars = buildLuckPillars(eightChar, input.gender);

  return {
    pillars,
    fiveElements,
    dayMaster,
    tenGods,
    luckPillars,
    solarTrueTime: trueTime.toISOString(),
  };
}

function toBaseSolarTime(input: BuildChartInput): Date {
  if (input.calendarType === "solar") return input.birthTime;

  const lf = getUTC8Fields(input.birthTime);
  const lunarMonth = input.isLeapMonth ? -lf.month : lf.month;
  const lunarDate = Lunar.fromYmdHms(lf.year, lunarMonth, lf.day, lf.hour, lf.minute, lf.second);
  const s = lunarDate.getSolar();
  const utcMs = Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), 0);
  return new Date(utcMs - UTC8_OFFSET_MS);
}

function parsePillar(gan: string, zhi: string) {
  if (!isStem(gan)) throw new Error(`lunar-javascript 返回非法天干: ${gan}`);
  if (!isBranch(zhi)) throw new Error(`lunar-javascript 返回非法地支: ${zhi}`);
  return { gan: gan as Stem, zhi: zhi as Branch };
}

function countFiveElements(p: BaziPillars): Record<Wuxing, number> {
  const init: Record<Wuxing, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  for (const pillar of [p.year, p.month, p.day, p.hour]) {
    init[wuxingOf(pillar.gan)] += 1;
    init[wuxingOf(pillar.zhi)] += 1;
  }
  return init;
}

// ── V2: Full calculation pipeline ─────────────────────────────────

export interface PillarDetail {
  gan: Stem;
  zhi: Branch;
  gan_wuxing: Wuxing;
  zhi_wuxing: Wuxing;
  yinyang: "yang" | "yin";
  nayin: string;
  nayinWuxing: Wuxing;
}

export interface DayunWithFortune extends DayunStep {
  fortune: FortuneLevel;
  dayunWuxing: Wuxing;
}

export interface LiunianWithFortune extends LiunianStep {
  fortune: FortuneLevel;
}

export interface TimeCorrection {
  true_solar_time: string;       // 校正后真太阳时 ISO
  real_hour_zhi: Branch;         // 校正后时辰地支
  solar_term: string;            // 所属节气名（如"立春"）
  is_jieqi_boundary: boolean;    // 是否在节气交界（前后1小时内）
  is_zishi_boundary: boolean;    // 是否在子时交界（23:00-01:00）
  leap_month: boolean;           // 是否闰月出生
}

export interface BaziChartV2 extends BaziComputed {
  // 时空校正元信息
  timeCorrection: TimeCorrection;
  // 四柱详细
  pillarDetails: {
    year: PillarDetail;
    month: PillarDetail;
    day: PillarDetail;
    hour: PillarDetail;
    full_pillar: string;
    day_gan: Stem;
    day_zhi: Branch;
  };
  // 五行能量
  wuxingCount: WuxingCountMap;
  wuxingStats: WuxingStats;
  xchhResult: XchhResult;
  wangXiangStatus: WangXiangStatus;
  finalScores: WuxingCountMap;
  // 十神
  tenGodsFull: TenGodsResult;
  // 旺衰
  strength: StrengthResult;
  // 喜用神
  yongShenFull: YongShenFull;
  // 向后兼容旧 yongShen 字段
  yongShen: YongShenResult;
  // 神煞
  shensha: ReadonlyArray<{
    name: string;
    interpretation: string;
    polarity: "吉" | "凶" | "中";
    categories: readonly string[];
  }>;
  // 大运含运势
  dayunWithFortune: DayunWithFortune[];
  // 流年
  liunian: ReadonlyArray<LiunianWithFortune>;
  // 六维标签
  labels: DimensionLabels[];
}

export function buildChartV2(input: BuildChartInput, opts?: { centerYear?: number }): BaziChartV2 {
  const base = buildChart(input);
  const pillars = base.pillars;
  const centerYear = opts?.centerYear ?? new Date().getUTCFullYear();
  const monthZhi = pillars.month.zhi;

  // 四柱详细
  const pillarDetails = {
    year: buildPillarDetail(pillars.year.gan, pillars.year.zhi),
    month: buildPillarDetail(pillars.month.gan, pillars.month.zhi),
    day: buildPillarDetail(pillars.day.gan, pillars.day.zhi),
    hour: buildPillarDetail(pillars.hour.gan, pillars.hour.zhi),
    full_pillar: `${pillars.year.gan}${pillars.year.zhi}年 ${pillars.month.gan}${pillars.month.zhi}月 ${pillars.day.gan}${pillars.day.zhi}日 ${pillars.hour.gan}${pillars.hour.zhi}时`,
    day_gan: pillars.day.gan,
    day_zhi: pillars.day.zhi,
  };

  // 1. 五行加权计数
  const wuxingCount = computeWuxingCount(pillars);
  const wuxingStats = computeWuxingStats(wuxingCount, monthZhi);

  // 2. 刑冲合害修正
  const xchhResult = applyXchhCorrection(pillars, wuxingCount);

  // 3. 旺相休囚死缩放
  const { scaled, dayMasterStatus } = applyWangXiangScaling(xchhResult.working_count, monthZhi);

  // 4. 日主微调
  const { final: finalScores } = applyDayMasterAdjust(scaled, pillars.day.gan, monthZhi);

  // 5. 十神汇总
  const tenGodsFull = computeTenGods(pillars, finalScores);

  // 6. 旺衰评分
  const strength = computeStrength(tenGodsFull, finalScores, pillars.day.gan);

  // 7. 喜用神
  const yongShenFull = computeYongShenFull(
    strength, pillars.day.gan, monthZhi, finalScores, xchhResult.matches,
  );

  // 8. 神煞
  const shenshaRules = detectAllShensha(pillars);

  // 9. 大运含运势等级
  const dayunSteps = computeDayun({
    pillars,
    gender: input.gender,
    solarBirthDate: base.solarTrueTime ? new Date(base.solarTrueTime) : new Date(),
  });

  const dayunWithFortune: DayunWithFortune[] = dayunSteps.map((d) => {
    const dayunWX = wuxingOf(d.stem);
    const tempFortune = computeTemporaryFortune({
      pillars,
      dayunStem: d.stem,
      dayunBranch: d.branch,
      monthZhi: pillars.month.zhi,
      dayGan: pillars.day.gan,
      strengthType: strength.strength_type,
    });
    const fortune = judgeFortuneLevel(d.stem, tempFortune, strength.strength_type, yongShenFull.xiyongshen, yongShenFull.jishen);
    return { ...d, fortune, dayunWuxing: dayunWX };
  });

  // 10. 流年（含运势）
  const birthYear = new Date(base.solarTrueTime).getUTCFullYear();
  const liunianRaw = computeLiunian({ centerYear, span: 5 });
  const liunian = liunianRaw.map((ln) => {
    const age = ln.year - birthYear;
    const currentDayun = dayunSteps.find((d) => age >= d.startAge && age <= d.endAge);
    const tempFortune = computeTemporaryFortune({
      pillars,
      dayunStem: currentDayun?.stem ?? pillars.day.gan,
      dayunBranch: currentDayun?.branch ?? pillars.month.zhi,
      liunianStem: ln.stem,
      liunianBranch: ln.branch,
      monthZhi: pillars.month.zhi,
      dayGan: pillars.day.gan,
      strengthType: strength.strength_type,
    });
    const fortune = judgeFortuneLevel(ln.stem, tempFortune, strength.strength_type, yongShenFull.xiyongshen, yongShenFull.jishen);
    return { ...ln, fortune };
  });

  // 11. 六维标签
  const shenshaNames = shenshaRules.map((r) => r.name);
  const labels = generateAllLabels(
    pillars,
    strength.strength_type,
    tenGodsFull.ten_gods_count,
    wuxingStats.strength_level,
    shenshaNames,
    input.gender,
  );

  // 12. 时空校正元信息
  const trueTimeDate = base.solarTrueTime ? new Date(base.solarTrueTime) : new Date();
  const tf = getUTC8Fields(trueTimeDate);
  const solarForJQ = Solar.fromYmdHms(tf.year, tf.month, tf.day, tf.hour, tf.minute, tf.second);
  const lunarForJQ = solarForJQ.getLunar();

  const jieQiTable = lunarForJQ.getJieQiTable();
  let solar_term = "";
  let is_jieqi_boundary = false;
  let minDiffHours = Infinity;
  const trueTimeMs = trueTimeDate.getTime();

  for (const [name, jqSolar] of Object.entries(jieQiTable)) {
    const jqMs = Date.UTC(jqSolar.getYear(), jqSolar.getMonth() - 1, jqSolar.getDay(), jqSolar.getHour(), jqSolar.getMinute(), 0);
    const diffHours = Math.abs(trueTimeMs - jqMs) / (1000 * 60 * 60);
    if (diffHours < minDiffHours) {
      minDiffHours = diffHours;
      solar_term = name;
      is_jieqi_boundary = diffHours <= 1;
    }
  }

  const hour = tf.hour;
  const is_zishi_boundary = hour >= 23 || hour < 1;
  const isLeapMonth = !!input.isLeapMonth;

  const timeCorrection: TimeCorrection = {
    true_solar_time: base.solarTrueTime ?? "",
    real_hour_zhi: pillars.hour.zhi,
    solar_term,
    is_jieqi_boundary,
    is_zishi_boundary,
    leap_month: isLeapMonth,
  };

  return {
    ...base,
    timeCorrection,
    pillarDetails,
    wuxingCount,
    wuxingStats,
    xchhResult,
    wangXiangStatus: dayMasterStatus,
    finalScores,
    tenGodsFull,
    strength,
    yongShenFull,
    yongShen: {
      gejuType: (strength.strength_type === "专旺格" ? "从强"
        : strength.strength_type === "从弱格" ? "从弱"
        : strength.strength_type) as GejuType,
      yongShen: yongShenFull.xiyongshen[0] ?? wuxingOf(pillars.day.gan),
      jiShen: yongShenFull.jishen[0] ?? null,
      strength: Math.max(0, Math.min(100, Math.round(50 + strength.final_score))),
      reason: yongShenFull.desc,
    },
    shensha: shenshaRules.map((r: ShenshaRule) => ({
      name: r.name,
      interpretation: r.interpretation,
      polarity: r.polarity,
      categories: r.categories,
    })),
    dayunWithFortune,
    liunian,
    labels,
  };
}

function buildPillarDetail(gan: Stem, zhi: Branch): PillarDetail {
  const ny = nayinOf(gan, zhi);
  return {
    gan,
    zhi,
    gan_wuxing: wuxingOf(gan),
    zhi_wuxing: wuxingOf(zhi),
    yinyang: "yang", // simplified
    nayin: ny?.nayin ?? "",
    nayinWuxing: ny?.nayinWuxing ?? "金",
  };
}

function buildLuckPillars(
  eightChar: EightChar,
  gender: BuildChartInput["gender"],
): LuckPillar[] {
  const yun = eightChar.getYun(gender === "male" ? 1 : 0);
  const dayun = yun.getDaYun();

  return dayun.slice(1, 9).map((d) => {
    const gz = d.getGanZhi();
    if (gz.length !== 2) throw new Error(`大运 GanZhi 格式异常: "${gz}"`);
    const gan = gz[0];
    const zhi = gz[1];
    if (!isStem(gan) || !isBranch(zhi)) throw new Error(`大运干支非法: "${gz}"`);
    return {
      age: d.getStartAge(),
      gan: gan as Stem,
      zhi: zhi as Branch,
    };
  });
}
