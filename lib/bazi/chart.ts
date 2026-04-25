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
} from "./stems-branches";
import { toSolarTrueTime } from "./solar-time";

const { Solar, Lunar } = lunar;

/**
 * 八字主入口：根据出生时间 + 经度 + 性别 + 历法类型计算完整八字
 *
 * 流程：
 *   1. 农历输入先转公历（Lunar.fromYmdHms → getSolar）
 *   2. 公历时间套真太阳时偏移（按经度）
 *   3. 用 lunar-javascript 根据真太阳时算四柱
 *   4. 五行计数 / 十神判定 / 大运 8 步
 */
/**
 * 八字采用 UTC+8 (北京标准时) 作为基准时区，**不考虑历史夏令时**。
 * 1986-1991 年中国大陆实施过夏令时，但传统八字排盘使用真太阳时校正后的 UTC+8 时间，
 * 不应受 DST 影响。这里直接用 UTC 偏移提取字段，绕过 JS Date 本地时区的 DST 表。
 */
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

  // 农历输入：按 UTC+8 提取 birthTime 字段作为农历年月日时分（避免 DST/时区漂移），
  // 转公历后重组为 UTC+8 Date（即 ISO 字符串带 +08:00）。
  const lf = getUTC8Fields(input.birthTime);
  const lunarDate = Lunar.fromYmdHms(lf.year, lf.month, lf.day, lf.hour, lf.minute, lf.second);
  const s = lunarDate.getSolar();
  // 用 UTC ms 重建：UTC+8 的 yyyy-mm-dd hh:mm:ss → 对应 UTC ms
  const utcMs = Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), 0);
  return new Date(utcMs - UTC8_OFFSET_MS);
}

function parsePillar(gan: string, zhi: string) {
  if (!isStem(gan)) {
    throw new Error(`lunar-javascript 返回非法天干: ${gan}`);
  }
  if (!isBranch(zhi)) {
    throw new Error(`lunar-javascript 返回非法地支: ${zhi}`);
  }
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

function buildLuckPillars(
  eightChar: EightChar,
  gender: BuildChartInput["gender"],
): LuckPillar[] {
  const yun = eightChar.getYun(gender === "male" ? 1 : 0);
  const dayun = yun.getDaYun();

  // lunar-javascript 的 getDaYun() 返回 10 项，第 0 项是"幼运"(空 GanZhi)，
  // 真正的大运从第 1 项开始（slice(1, 9) 取 8 步）。
  return dayun.slice(1, 9).map((d) => {
    const gz = d.getGanZhi();
    if (gz.length !== 2) {
      throw new Error(`大运 GanZhi 格式异常: "${gz}"`);
    }
    const gan = gz[0];
    const zhi = gz[1];
    if (!isStem(gan) || !isBranch(zhi)) {
      throw new Error(`大运干支非法: "${gz}"`);
    }
    return {
      age: d.getStartAge(),
      gan: gan as Stem,
      zhi: zhi as Branch,
    };
  });
}
