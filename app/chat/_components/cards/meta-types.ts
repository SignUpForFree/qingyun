/**
 * 卡片 metadata.* 解析后类型 — 与 spec §4.4 22 ui 对齐
 *
 * MessageBubble 的 dispatcher 用 `as unknown as` 把 parseMeta 的结果窄化到这些接口；
 * 抽出来集中维护，避免 dispatcher 文件被 80 行 interface 噪音淹掉。
 */

import type { SlipLevel } from "@/db/seed/slips-v2";
import type { BaziPillars, BaziTenGods } from "@/types/domain";
import type { Wuxing } from "@/lib/bazi/stems-branches";
import type { ErrorCode } from "./ErrorCard";
import type { LongTaskStage } from "./ProgressLongTaskCard";
import type { SlipImageLevel } from "./SlipImageFullscreen";

export interface MetaUi {
  ui: string;
  [k: string]: unknown;
}

export interface SlipImageMeta {
  slipNumber: number;
  level: SlipLevel;
  title: string;
  poem?: string;
  poemLines?: string[];
  imageUrl?: string;
  dimension?: string;
  reading?: string;
  category?: string;
  /** design §7 6 dim tabs：综合/事业/财运/感情/人际/健康 → reading 文本 */
  readings?: Partial<Record<"综合" | "事业" | "财运" | "感情" | "人际" | "健康", string>>;
}

export interface BaziResultMeta {
  focus: string;
  chart: {
    pillars: BaziPillars;
    fiveElements: Record<Wuxing, number>;
    dayMaster: string;
    tenGods: BaziTenGods;
    currentLuck: string;
  };
}

export interface DreamResultMeta {
  mode?: "fast" | "precise";
  /** 🌙 开篇共情 */
  empathy?: string;
  /** 🔮 三重维度 */
  threeViews?: {
    zhouGong: string;
    freud: string;
    jung: string;
  };
  /** 📜 核心寓意 */
  coreMeaning?: string;
  /** 💡 规避方案 */
  suggestions?: string[];
  /** 💌 潜意识真心话 */
  subconsciousMsg?: string;
  /** 🌷 结语 */
  conclusion?: string;
  summary?: string;
}

export interface ProfilePickerMeta {
  profiles: Array<{
    id: string;
    nickname: string;
    isDefault: boolean;
    avatarUrl?: string;
    birthDate?: string;
    gender?: "male" | "female" | "other";
  }>;
  conversationId?: string;
  allowAddNew?: boolean;
}

export interface ErrorCardMeta {
  message: string;
  code?: ErrorCode;
  retryable?: boolean;
}

export interface ProgressLongTaskMeta {
  etaSec?: number;
  stage?: LongTaskStage;
  percent?: number;
  cancellable?: boolean;
}

export interface SlipReportMeta {
  slipNumber: number;
  level: SlipImageLevel;
  title: string;
  poem: string;
  dimension: string;
  reading: string;
  aiInterpretation: string;
  isFullInterpret?: boolean;
  sections?: Array<{
    emoji: string;
    label: string;
    shortReading: string;
    longReading: string;
  }>;
}

export interface MeihuaResultMeta {
  ben: { number: number; name: string; upper: string; lower: string };
  hu: { number: number; name: string; upper: string; lower: string };
  bian: { number: number; name: string; upper: string; lower: string };
  guaZhongGua: { number: number; name: string; upper: string; lower: string };
  dongYao: number;
  tiYong: { ti: string; yong: string; relation: string };
  yingQi: { speed: "fast" | "medium" | "slow"; timeHint: string; branchHour: string | null };
  verdict: string;
  aiText?: string;
}

export function parseMeta(raw: string | null | undefined): MetaUi | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MetaUi;
  } catch {
    return null;
  }
}
