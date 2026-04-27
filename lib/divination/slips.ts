import { createHash } from "node:crypto";
import { SLIPS_V2 } from "@/db/seed/slips-v2";
import { seedToSpecLevel, type SpecLevel } from "./slip-level";

/**
 * 灵签抽取（M3.2 加权 + 确定性 seed）
 *
 * - pickSlip：纯 number 选取（旧 V1 接口，保留兼容）
 * - drawSlip：6 类 + profileId/date/question 输入，确定性加权 → 返回完整 slip + 当前维度解读
 *
 * 加权基线（spec §4.3）：上上 8 / 上吉 15 / 中吉 35 / 中平 30 / 下下 12（共 100 签）
 */

export interface SlipPick {
  number: number;
}

export const SLIPS_MAX = 100;

export function pickSlip(opts?: { seed?: string; max?: number }): SlipPick {
  const max = opts?.max ?? SLIPS_MAX;
  if (opts?.seed) {
    const hash = createHash("sha256").update(opts.seed).digest();
    const n = (hash.readUInt32BE(0) % max) + 1;
    return { number: n };
  }
  return { number: Math.floor(Math.random() * max) + 1 };
}

// ============ M3.2 drawSlip ============

export const DIVINATION_DIMS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;
export type DivinationDim = (typeof DIVINATION_DIMS)[number];

export const BASE_WEIGHTS: Record<SpecLevel, number> = {
  上上: 8,
  上吉: 15,
  中吉: 35,
  中平: 30,
  下下: 12,
};

export interface DrawSlipArgs {
  profileId: string;
  date: string;
  question: string;
  category: DivinationDim;
}

export interface SlipFull {
  number: number;
  level: SpecLevel;
  title: string;
  poem: string;
  poemLines: readonly string[];
  defaultReading: string;
  categoryReadings: Record<DivinationDim, string>;
}

export interface DrawnSlip {
  slipNumber: number;
  slip: SlipFull;
  dimensionReading: string;
}

/**
 * 确定性 seed：同一 (profileId, date, question, category) 永远抽到同一签
 *
 * 实现：sha256(seed) → 数 → 加权采样
 */
export function drawSlip(args: DrawSlipArgs): DrawnSlip {
  const seed = `${args.profileId}:${args.date}:${args.question}:${args.category}`;
  const slipNumber = pickWeighted(seed);
  const slip = getSlip(slipNumber);
  return {
    slipNumber,
    slip,
    dimensionReading: slip.categoryReadings[args.category],
  };
}

/**
 * 加权采样：每签一票，按 BASE_WEIGHTS[level] 倍数堆叠
 * 返回 1-100 的 slipNumber
 */
export function pickWeighted(seed: string): number {
  const totalWeight = SLIPS_V2.reduce(
    (acc, s) => acc + BASE_WEIGHTS[seedToSpecLevel(s.level)],
    0,
  );

  // sha256 截前 8 字节 → 大整数 → mod totalWeight
  const hash = createHash("sha256").update(seed).digest();
  // 用前 8 字节构造一个 BigInt，再 % totalWeight
  const u64 = (BigInt(hash.readUInt32BE(0)) << 32n) | BigInt(hash.readUInt32BE(4));
  const target = Number(u64 % BigInt(totalWeight));

  let cursor = 0;
  for (const s of SLIPS_V2) {
    const w = BASE_WEIGHTS[seedToSpecLevel(s.level)];
    cursor += w;
    if (target < cursor) return s.number;
  }
  // fallback（理论不达）
  return SLIPS_V2[SLIPS_V2.length - 1]!.number;
}

export function getSlip(number: number): SlipFull {
  const found = SLIPS_V2.find((s) => s.number === number);
  if (!found) {
    throw new Error(`slip number ${number} not in SLIPS_V2`);
  }
  return {
    number: found.number,
    level: seedToSpecLevel(found.level),
    title: found.title,
    poem: found.poem,
    poemLines: splitPoemLines(found.poem),
    defaultReading: found.readings.综合运势,
    categoryReadings: found.readings as Record<DivinationDim, string>,
  };
}

function splitPoemLines(poem: string): string[] {
  return poem
    .split(/[\n，。！？]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
}
