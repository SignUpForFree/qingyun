import lunar from "lunar-javascript";

const { Solar } = lunar;

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface LunarToday {
  /** 干支纪年 + "年"，例：丙午年 */
  ganzhiYear: string;
  /** 农历月日，例：三月初七 */
  lunarMonthDay: string;
  /** 节气名（当日命中），无则空串 */
  jieqi: string;
  /** 完整 header 文案，例：丙午年 · 三月初七 · 谷雨 */
  headerText: string;
  /** 时辰问候，按当前时分 */
  greeting: "清晨好" | "上午好" | "午安" | "下午好" | "晚上好" | "夜深了";
}

/**
 * 取当下（UTC+8）农历 + 节气 + 时辰问候
 *
 * 用 lunar-javascript 的 Solar→Lunar 反查；当日节气用 getJieQi() 命中即取。
 */
export function getLunarToday(date: Date = new Date()): LunarToday {
  const d = new Date(date.getTime() + UTC8_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();

  const solar = Solar.fromYmdHms(y, m, day, 12, 0, 0);
  const ln = solar.getLunar();

  const ganzhiYear = `${ln.getYearInGanZhi()}年`;
  const lunarMonthDay = `${ln.getMonthInChinese()}月${ln.getDayInChinese()}`;

  const jieqiMap = ln.getJieQiTable();
  let jieqi = "";
  for (const name of Object.keys(jieqiMap)) {
    // 过滤 lunar-javascript 内部的英文常量 key（如 "DA_XUE"），只保留中文节气名
    if (!/^[一-龥]+$/.test(name)) continue;
    const jq = jieqiMap[name];
    if (
      jq &&
      jq.getYear() === y &&
      jq.getMonth() === m &&
      jq.getDay() === day
    ) {
      jieqi = name;
      break;
    }
  }

  const headerText = jieqi
    ? `${ganzhiYear} · ${lunarMonthDay} · ${jieqi}`
    : `${ganzhiYear} · ${lunarMonthDay}`;

  return {
    ganzhiYear,
    lunarMonthDay,
    jieqi,
    headerText,
    greeting: pickGreeting(hour),
  };
}

function pickGreeting(hour: number): LunarToday["greeting"] {
  if (hour < 5) return "夜深了";
  if (hour < 9) return "清晨好";
  if (hour < 11) return "上午好";
  if (hour < 13) return "午安";
  if (hour < 18) return "下午好";
  if (hour < 23) return "晚上好";
  return "夜深了";
}
