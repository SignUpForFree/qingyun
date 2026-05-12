/**
 * lib/bazi — 八字排盘公开 API
 *
 * 这层是"算法库"，纯函数，**不依赖** server-only / DB / network。
 * 任何地方（API route / fortune 计算 / 单测 / 未来 worker）都能 import。
 *
 * 上层调用建议走 `@/lib/divination-providers/bazi` 的 BaziProvider 抽象，
 * 以便未来切第三方 API 时不必修改业务代码。
 */

// 主排盘入口
export {
  buildChart,
  buildChartV2,
  type BaziChartV2,
} from "./chart";

// 干支 / 五行 / 十神
export {
  isStem,
  isBranch,
  wuxingOf,
  tenGod,
  branchHourRange,
  relation,
  jiaziAt,
  mainHiddenStem,
  stemHe,
  isLiuHe,
  isChong,
  findSanHe,
  findSanHui,
  TEN_STEMS,
  TWELVE_BRANCHES,
  SHENG_CYCLE,
  KE_CYCLE,
  HIDDEN_STEMS,
  BRANCH_LIU_HE,
  BRANCH_CHONG,
  SAN_HE_GROUPS,
  SAN_HUI_GROUPS,
  JIAZI,
  type Wuxing,
  type Stem,
  type Branch,
  type TenGod,
  type BranchHourRange,
  type Jiazi,
} from "./stems-branches";

// 真太阳时
export { toSolarTrueTime } from "./solar-time";

// 神煞规则
export {
  SHENSHA_RULES,
  matchShensha,
  detectAllShensha,
  detectShenshaByDim,
  type ShenshaRule,
  type V2DivinationDim,
} from "./shensha-rules";

// 大运 / 流年
export {
  computeDayun,
  computeLiunian,
  yearToPillar,
  rotateMonthPillar,
  type DayunStep,
  type ComputeDayunArgs,
  type LiunianStep,
  type ComputeLiunianArgs,
} from "./dayun";

// 用神
export {
  determineYongShen,
  scoreStrength,
  isWeak,
  isStrong,
  type GejuType,
  type YongShenResult,
  type DetermineYongShenArgs,
} from "./yong-shen";

// 当日日柱（fortune 计算用）
export { getDayPillar, type DayPillar } from "./today";
