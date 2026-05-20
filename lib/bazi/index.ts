/**
 * lib/bazi — 八字排盘公开 API
 *
 * 这层是"算法库"，纯函数，**不依赖** server-only / DB / network。
 * 任何地方（API route / fortune 计算 / 单测 / 未来 worker）都能 import。
 */

// 主排盘入口
export {
  buildChart,
  buildChartV2,
  type BaziChartV2,
  type PillarDetail,
  type DayunWithFortune,
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
  nayinOf,
  yinyangOfStem,
  tenGodCamp,
  wangXiangStatus,
  dayMasterAdjustScore,
  TEN_STEMS,
  TWELVE_BRANCHES,
  SHENG_CYCLE,
  KE_CYCLE,
  HIDDEN_STEMS,
  HIDDEN_STEMS_DETAILED,
  BRANCH_LIU_HE,
  BRANCH_CHONG,
  SAN_HE_GROUPS,
  SAN_HE_RULES,
  SAN_HUI_GROUPS,
  SAN_XING_RULES,
  LIU_HAI_PAIRS,
  ZI_XING_BRANCHES,
  LIU_HE_RULES,
  YUELING_WUXING,
  WANG_XIANG_COEFF,
  JIAZI,
  type Wuxing,
  type Stem,
  type Branch,
  type TenGod,
  type BranchHourRange,
  type Jiazi,
  type HiddenStemEntry,
  type HiddenStemWeight,
  type WangXiangStatus,
  type LiuHeRule,
  type SanHeRule,
  type SanXingRule,
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

// 用神（旧API兼容）
export {
  determineYongShen,
  scoreStrength,
  isWeak,
  isStrong,
  type GejuType,
  type YongShenResult,
  type DetermineYongShenArgs,
} from "./yong-shen";

// 核心计算引擎
export {
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
  type XchhMatch,
  type TenGodsResult,
  type StrengthResult,
  type StrengthType,
  type YongShenFull,
} from "./engine";

// 标签 + 运势
export {
  generateAllLabels,
  judgeFortuneLevel,
  type LabelRule,
  type DimensionLabels,
  type FortuneLevel,
} from "./labels";

// 当日日柱（fortune 计算用）
export { getDayPillar, type DayPillar } from "./today";
