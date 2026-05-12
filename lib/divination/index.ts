/**
 * lib/divination — 抽签 / 梅花易数 / 解梦的纯算法库
 *
 * 与 `lib/bazi/` 同性质：纯函数 / 无 IO / 无 server-only。
 *
 * 上层调用建议走 `@/lib/divination-providers` 里的 Provider 抽象层，
 * 让未来切第三方 API 时业务代码零改动。
 */

// 抽签
export {
  drawSlip,
  pickSlip,
  pickWeighted,
  getSlip,
  adjustWeights,
  SLIPS_MAX,
  DIVINATION_DIMS,
  BASE_WEIGHTS,
  type SlipPick,
  type DivinationDim,
  type DrawSlipArgs,
  type DrawnSlip,
  type SlipFull,
} from "./slips";

// 签解级别
export {
  isSlipLevel,
  SLIP_LEVELS,
  type SlipLevel,
} from "./slip-level";

// 梅花易数 V2
export {
  meihuaV2,
  type MeihuaV2Args,
  type MeihuaV2Result,
  type GuaDictView,
} from "./meihua-v2";

// 时辰能量场
export {
  computeTimeEnergy,
  type TimeAlignment,
  type TimeEnergyResult,
  type ComputeTimeEnergyArgs,
} from "./time-energy";

// 五行损益
export {
  computeSunYi,
  type SunYiAdjustment,
  type SunYiResult,
  type ComputeSunYiArgs,
} from "./sunyi";

// 解梦
export {
  buildEmotionHint,
  dreamInputSchema,
  DREAM_EMOTIONS,
  type DreamEmotion,
  type DreamInput,
} from "./dream-parser";
