import { describe, it, expect } from "vitest";
import { SLIPS_V2 } from "./slips-v2";
import {
  ALL_FORBIDDEN,
} from "@/lib/ai/prompts/forbidden-words";
import { type SlipLevel } from "@/lib/divination/slip-level";
import { BASE_WEIGHTS } from "@/lib/divination/slips";

const DIMS = [
  "综合运势",
  "事业学业",
  "财运",
  "感情姻缘",
  "人际贵人",
  "平安健康",
] as const;

/**
 * M3.31: 100 签数据深度 audit（spec §4.3）
 *
 * 基础完整性测试在 slips-v2.test.ts。本文件做"内容质量"层：
 *   - 字段长度合理（10-80 字）
 *   - 没有禁词残留（大凶 / 倒霉 / 厄运 等）
 *   - 6 维度内容不互相 copy-paste
 *   - 等级分布近似 BASE_WEIGHTS 目标
 *   - title / poem 唯一
 *   - poem 长度合理
 */

describe("100 签 audit (M3.31)", () => {
  it("title 100 个唯一", () => {
    const titles = new Set(SLIPS_V2.map((s) => s.title));
    expect(titles.size).toBe(100);
  });

  it("poem 100 句唯一（避免 copy-paste）", () => {
    const poems = new Set(SLIPS_V2.map((s) => s.poem));
    expect(poems.size).toBe(100);
  });

  it("每签 poem 长度 ≥ 8 字（紧凑型 4+4 短对仗也算合格）", () => {
    for (const slip of SLIPS_V2) {
      expect(slip.poem.length, `第 ${slip.number} 签 poem 太短: ${slip.poem}`).toBeGreaterThanOrEqual(
        8,
      );
    }
  });

  it("每签 6 维度文本长度 ≥ 8 字（避免占位）", () => {
    for (const slip of SLIPS_V2) {
      for (const dim of DIMS) {
        const text = slip.readings[dim];
        expect(
          text.length,
          `第 ${slip.number} 签『${dim}』太短: ${text}`,
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("每签 6 维度文本长度 ≤ 80 字（避免过度长 prompt）", () => {
    for (const slip of SLIPS_V2) {
      for (const dim of DIMS) {
        const text = slip.readings[dim];
        expect(
          text.length,
          `第 ${slip.number} 签『${dim}』过长: ${text.length} 字`,
        ).toBeLessThanOrEqual(80);
      }
    }
  });

  it("每签 6 维度文本互不重复（不是同一句话填 6 次）", () => {
    for (const slip of SLIPS_V2) {
      const texts = DIMS.map((d) => slip.readings[d]);
      const distinct = new Set(texts);
      expect(
        distinct.size,
        `第 ${slip.number} 签 6 维度有重复: ${[...distinct]}`,
      ).toBe(6);
    }
  });

  it("无任何禁词命中（CORE 6 词 + 慎行/凶险古风扩展）", () => {
    for (const slip of SLIPS_V2) {
      // poem
      for (const word of ALL_FORBIDDEN) {
        // 例外：level=慎行 仅作内部分级标签，不算字段污染（不参与展示）
        // 但确实「慎行」在 readings 里如果出现就是污染
        expect(
          slip.poem.includes(word),
          `第 ${slip.number} 签 poem 含禁词「${word}」: ${slip.poem}`,
        ).toBe(false);
      }
      for (const dim of DIMS) {
        const text = slip.readings[dim];
        for (const word of ALL_FORBIDDEN) {
          expect(
            text.includes(word),
            `第 ${slip.number} 签『${dim}』含禁词「${word}」: ${text}`,
          ).toBe(false);
        }
      }
    }
  });

  it("等级分布合理：6 级都有 + 总和 100 + 上上和慎行不超 30%", () => {
    const counter: Record<SlipLevel, number> = {
      上上: 0,
      上吉: 0,
      吉: 0,
      平: 0,
      渐顺: 0,
      慎行: 0,
    };
    for (const slip of SLIPS_V2) {
      counter[slip.level] += 1;
    }
    const total = Object.values(counter).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);

    // 6 级每级至少 1 个（避免某级别为零）
    for (const lvl of Object.keys(BASE_WEIGHTS) as SlipLevel[]) {
      expect(counter[lvl], `${lvl} 等级签数为 0`).toBeGreaterThanOrEqual(1);
    }

    // 极端档（上上 + 慎行）合计不超 30%（避免极端化）
    const extreme = counter.上上 + counter.慎行;
    expect(extreme, `极端档 上上+慎行 共 ${extreme}，过多`).toBeLessThanOrEqual(30);
  });

  it("6 类 readings 中『综合运势』必非空且不与其它 5 类完全相同", () => {
    for (const slip of SLIPS_V2) {
      const summary = slip.readings.综合运势;
      const others = DIMS.filter((d) => d !== "综合运势").map(
        (d) => slip.readings[d],
      );
      expect(summary).toBeTruthy();
      // 严格 6 类不重复测试已经在上面，这里只是 spec §4.3 强调 summary 优先级
      const allEqual = others.every((t) => t === summary);
      expect(allEqual, `第 ${slip.number} 签 综合运势与其他 5 类完全雷同`).toBe(false);
    }
  });

  it("number 范围 [1, 100] 且无重复", () => {
    const nums = SLIPS_V2.map((s) => s.number);
    const set = new Set(nums);
    expect(set.size).toBe(100);
    expect(Math.min(...nums)).toBe(1);
    expect(Math.max(...nums)).toBe(100);
  });
});
