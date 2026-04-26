import { describe, it, expect } from "vitest";
import { SLIPS_V2 } from "./slips-v2";

describe("100 支签 seed", () => {
  it("总数 100", () => {
    expect(SLIPS_V2).toHaveLength(100);
  });

  it("签号连续 1-100", () => {
    for (let i = 0; i < 100; i++) {
      expect(SLIPS_V2[i].number).toBe(i + 1);
    }
  });

  it("每支签 6 维度解读完整且非空", () => {
    const required = ["综合运势", "事业学业", "财运", "感情姻缘", "人际贵人", "平安健康"] as const;
    for (const slip of SLIPS_V2) {
      for (const dim of required) {
        expect(slip.readings[dim]).toBeTypeOf("string");
        expect(slip.readings[dim].length).toBeGreaterThan(2);
      }
    }
  });

  it("等级是 6 类之一", () => {
    const levels = ["上上", "上吉", "吉", "平", "渐顺", "慎行"];
    for (const slip of SLIPS_V2) {
      expect(levels).toContain(slip.level);
    }
  });

  it("第 1 签 心定福自来 / 上上", () => {
    expect(SLIPS_V2[0].title).toBe("心定福自来");
    expect(SLIPS_V2[0].level).toBe("上上");
  });

  it("第 100 签 静心养气 / 慎行", () => {
    expect(SLIPS_V2[99].title).toBe("静心养气");
    expect(SLIPS_V2[99].level).toBe("慎行");
  });
});
