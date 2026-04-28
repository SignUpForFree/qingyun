import { describe, it, expect } from "vitest";
import { numberToChinese, chineseSignature } from "./cn-numerals";

describe("numberToChinese", () => {
  it("1-9 → 一-九", () => {
    expect(numberToChinese(1)).toBe("一");
    expect(numberToChinese(9)).toBe("九");
  });
  it("10-19 → 十/十一-十九", () => {
    expect(numberToChinese(10)).toBe("十");
    expect(numberToChinese(15)).toBe("十五");
  });
  it("20-99 → X十/X十Y", () => {
    expect(numberToChinese(20)).toBe("二十");
    expect(numberToChinese(86)).toBe("八十六");
    expect(numberToChinese(99)).toBe("九十九");
  });
  it("100 → 一百", () => {
    expect(numberToChinese(100)).toBe("一百");
  });
  it("超界抛错", () => {
    expect(() => numberToChinese(0)).toThrow();
    expect(() => numberToChinese(101)).toThrow();
    expect(() => numberToChinese(1.5)).toThrow();
  });
});

describe("chineseSignature", () => {
  it("拆字 + 间隔 ·", () => {
    expect(chineseSignature(86)).toBe("八 · 十 · 六");
    expect(chineseSignature(8)).toBe("八");
    expect(chineseSignature(15)).toBe("十 · 五");
    expect(chineseSignature(100)).toBe("一 · 百");
  });
});
