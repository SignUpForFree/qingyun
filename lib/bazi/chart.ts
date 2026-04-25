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
export function buildChart(input: BuildChartInput): BaziComputed {
  const baseSolar = toBaseSolarTime(input);
  const trueTime = toSolarTrueTime(baseSolar, input.longitude);

  const solar = Solar.fromYmdHms(
    trueTime.getFullYear(),
    trueTime.getMonth() + 1,
    trueTime.getDate(),
    trueTime.getHours(),
    trueTime.getMinutes(),
    trueTime.getSeconds(),
  );
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

  const lunarDate = Lunar.fromYmdHms(
    input.birthTime.getFullYear(),
    input.birthTime.getMonth() + 1,
    input.birthTime.getDate(),
    input.birthTime.getHours(),
    input.birthTime.getMinutes(),
    input.birthTime.getSeconds(),
  );
  const s = lunarDate.getSolar();
  return new Date(
    s.getYear(),
    s.getMonth() - 1,
    s.getDay(),
    s.getHour(),
    s.getMinute(),
    0,
  );
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
