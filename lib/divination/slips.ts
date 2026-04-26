import { createHash } from "node:crypto";

/**
 * 灵签随机抽取
 *
 * - 不带 seed → Math.random（每次都不同）
 * - 带 seed → SHA-256 截前 4 字节 → 模运算，同一 seed 永远得同一签
 *
 * 业务用法：seed = `${userId}-${Date.now()}` 让用户每次抽都不同；
 * 测试用法：固定 seed → 可预测。
 */
export interface SlipPick {
  number: number; // 1..MAX
}

const DEFAULT_MAX = 30; // 当前 seed 30 签；100 签 ready 后改 100
export const SLIPS_MAX = DEFAULT_MAX;

export function pickSlip(opts?: { seed?: string; max?: number }): SlipPick {
  const max = opts?.max ?? DEFAULT_MAX;
  if (opts?.seed) {
    const hash = createHash("sha256").update(opts.seed).digest();
    const n = (hash.readUInt32BE(0) % max) + 1;
    return { number: n };
  }
  return { number: Math.floor(Math.random() * max) + 1 };
}
